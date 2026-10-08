import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import type { Database } from 'bun:sqlite';
import { setupTestApp, cleanupTestDB, seedTestData } from '../../../tests/fixtures';
import { AdminPluginService } from '../admin-plugins';
import { ENABLED_KEY, pluginRegistry } from '../../plugins/registry';
import type { RinPlugin } from '../../plugins/types';
import { makePluginContext } from '../../plugins/__tests__/test-helpers';

/**
 * 插件启停的测试：管理员关掉插件后，下一个请求就不该再派发它的钩子
 * （依赖每请求开始时的 syncEnabledFromConfig，常驻 isolate 下只在启动时读配置不够）。
 */
function makePlugin(name: string, hooks: Partial<RinPlugin> = {}): RinPlugin {
  return {
    manifest: { name, displayName: name, version: '1.0.0' },
    ...hooks,
  };
}

describe('插件启停', () => {
  let sqlite: Database;
  let env: Env;
  let app: any;
  let serverConfig: any;

  beforeEach(async () => {
    const ctx = await setupTestApp(AdminPluginService);
    sqlite = ctx.sqlite;
    env = ctx.env;
    app = ctx.app;
    serverConfig = ctx.serverConfig;

    // setupTestApp 不会自动播种，必须显式调用（照 comments.test.ts 的做法）
    // seedTestData 建的是：id=1 普通用户（permission=0）、id=2 管理员（permission=1）
    await seedTestData(sqlite);

    pluginRegistry.reset();
  });

  afterEach(() => {
    pluginRegistry.reset();
    cleanupTestDB(sqlite);
  });

  // 对应 seedTestData：user2(id=2) 是管理员，user1(id=1) 不是
  const asAdmin = { Authorization: 'Bearer mock_token_2' };
  const asUser = { Authorization: 'Bearer mock_token_1' };

  // ===== 列表 =====

  describe('GET / 列出插件', () => {
    it('should reject an anonymous caller', async () => {
      const res = await app.request('/', { method: 'GET' }, env);
      expect(res.status).toBe(401);
    });

    it('should reject a non-admin caller', async () => {
      const res = await app.request('/', { method: 'GET', headers: asUser }, env);
      expect(res.status).toBe(403);
    });

    it('should list registered plugins with their capabilities', async () => {
      pluginRegistry.register(
        makePlugin('full', {
          comment: { beforeCreate: () => undefined, afterCreate: () => undefined },
          feed: { beforeSave: () => undefined },
          routes: () => {},
          setup: () => undefined,
        }),
      );
      pluginRegistry.register(makePlugin('minimal'));

      const res = await app.request('/', { method: 'GET', headers: asAdmin }, env);
      expect(res.status).toBe(200);

      const body = await res.json() as any;
      expect(body.enabledKey).toBe(ENABLED_KEY);
      expect(body.plugins).toHaveLength(2);

      const full = body.plugins.find((p: any) => p.name === 'full');
      expect(full.displayName).toBe('full');
      expect(full.version).toBe('1.0.0');
      expect(full.status).toBe('enabled');
      expect(full.apiPrefix).toBe('/plugins/full');
      expect(full.capabilities).toContain('comment.beforeCreate');
      expect(full.capabilities).toContain('feed.beforeSave');
      expect(full.capabilities).toContain('routes');

      // 没声明 routes 的插件 apiPrefix 应为 null
      const minimal = body.plugins.find((p: any) => p.name === 'minimal');
      expect(minimal.apiPrefix).toBeNull();
      expect(minimal.capabilities).toHaveLength(0);
    });

    it('should expose the error reason for a failed plugin', async () => {
      pluginRegistry.register(
        makePlugin('broken', {
          setup: () => {
            throw new Error('启动炸了');
          },
        }),
      );
      await pluginRegistry.loadAll(async () => makePluginContext({ pluginName: 'broken' }));

      const res = await app.request('/', { method: 'GET', headers: asAdmin }, env);
      const body = await res.json() as any;

      const broken = body.plugins.find((p: any) => p.name === 'broken');
      expect(broken.status).toBe('error');
      expect(broken.error).toContain('启动炸了');
    });
  });

  // ===== 切换启停 =====

  describe('PUT /:name 启停', () => {
    beforeEach(() => {
      pluginRegistry.register(makePlugin('toggleable'));
    });

    it('should reject a non-admin caller', async () => {
      const res = await app.request('/toggleable', {
        method: 'PUT',
        headers: { ...asUser, 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: false }),
      }, env);
      expect(res.status).toBe(403);
    });

    it('should reject an unknown plugin with 404', async () => {
      const res = await app.request('/nope', {
        method: 'PUT',
        headers: { ...asAdmin, 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: true }),
      }, env);
      expect(res.status).toBe(404);
    });

    it('should reject a malformed body', async () => {
      for (const body of ['{}', '{"enabled":"yes"}', 'not json', '{"enabled":1}']) {
        const res = await app.request('/toggleable', {
          method: 'PUT',
          headers: { ...asAdmin, 'Content-Type': 'application/json' },
          body,
        }, env);
        expect(res.status).toBe(400);
      }
    });

    it('should persist the enabled list', async () => {
      const res = await app.request('/toggleable', {
        method: 'PUT',
        headers: { ...asAdmin, 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: true }),
      }, env);

      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.data.status).toBe('enabled');
      expect(body.data.enabledList).toContain('toggleable');

      // 状态必须落到配置里，否则刷新页面就没了
      const stored = await serverConfig.get(ENABLED_KEY);
      expect(String(stored)).toContain('toggleable');
    });

    it('should remove from the list when disabling', async () => {
      await serverConfig.set(ENABLED_KEY, 'toggleable,other', true);

      const res = await app.request('/toggleable', {
        method: 'PUT',
        headers: { ...asAdmin, 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: false }),
      }, env);

      const body = await res.json() as any;
      expect(body.data.status).toBe('disabled');
      expect(body.data.enabledList).not.toContain('toggleable');
      // 不能误伤其他插件
      expect(body.data.enabledList).toContain('other');
    });

    it('should not duplicate when enabling twice', async () => {
      for (let i = 0; i < 2; i += 1) {
        const res = await app.request('/toggleable', {
          method: 'PUT',
          headers: { ...asAdmin, 'Content-Type': 'application/json' },
          body: JSON.stringify({ enabled: true }),
        }, env);
        expect(res.status).toBe(200);
      }

      // 启用列表存在配置里，直接查它而不是靠列表接口
      const stored = String(await serverConfig.get(ENABLED_KEY) ?? '');
      const names = stored.split(',').map((item) => item.trim()).filter(Boolean);
      expect(names.filter((name) => name === 'toggleable')).toHaveLength(1);
    });

    it('should refuse to toggle a plugin that failed to load', async () => {
      pluginRegistry.reset();
      pluginRegistry.register(
        makePlugin('broken', {
          setup: () => {
            throw new Error('炸了');
          },
        }),
      );
      await pluginRegistry.loadAll(async () => makePluginContext({ pluginName: 'broken' }));

      const res = await app.request('/broken', {
        method: 'PUT',
        headers: { ...asAdmin, 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: true }),
      }, env);

      // 启用一个没跑起来的插件会让人误以为已生效，必须拒绝
      expect(res.status).toBe(409);
      const body = await res.json() as any;
      expect(body.error.code).toBe('PLUGIN_ERRORED');
    });
  });

  // ===== 插件设置 =====

  describe('插件设置读写', () => {
    // 键名由插件自己声明，服务端不猜清单
    beforeEach(() => {
      pluginRegistry.reset();
      pluginRegistry.register({
        manifest: { name: 'album', displayName: 'Album', version: '1.0.0' },
        publicSettings: ['images'],
        settingKeys: ['images', 'captions', 'interval', 'height'],
      });
    });
    it('should reject anonymous and non-admin callers', async () => {
      const anon = await app.request('/any/settings', { method: 'GET' }, env);
      expect(anon.status).toBe(401);

      const anonPut = await app.request('/any/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: { a: '1' } }),
      }, env);
      expect(anonPut.status).toBe(401);

      const user = await app.request('/any/settings', {
        method: 'GET',
        headers: asUser,
      }, env);
      expect(user.status).toBe(403);
    });

    it('should reject a malformed values payload', async () => {
      for (const body of ['{}', '{"values":null}', '{"values":123}', 'not json']) {
        const res = await app.request('/p/settings', {
          method: 'PUT',
          headers: { ...asAdmin, 'Content-Type': 'application/json' },
          body,
        }, env);
        expect(res.status).toBe(400);
      }
    });

    it('should save and read back settings', async () => {
      const put = await app.request('/album/settings', {
        method: 'PUT',
        headers: { ...asAdmin, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          values: { images: 'a.jpg,b.jpg', interval: '5000', enabled: 'true' },
        }),
      }, env);

      expect(put.status).toBe(200);
      const putBody = await put.json() as any;
      expect(putBody.success).toBe(true);

      // 值必须落到 serverConfig
      expect(await serverConfig.get('album.images')).toBe('a.jpg,b.jpg');
      expect(await serverConfig.get('album.interval')).toBe('5000');

      const get = await app.request('/album/settings', {
        method: 'GET',
        headers: asAdmin,
      }, env);
      const getBody = await get.json() as any;
      expect(getBody.data.values.images).toBe('a.jpg,b.jpg');
    });

    it('should serialize arrays as comma-separated strings', async () => {
      await app.request('/album/settings', {
        method: 'PUT',
        headers: { ...asAdmin, 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: { images: ['a.jpg', 'b.jpg'] } }),
      }, env);

      expect(await serverConfig.get('album.images')).toBe('a.jpg,b.jpg');
    });

    it('should read back values immediately after saving', async () => {
    // 回归：之前用 getByPrefix 读回，内存快照刚 PUT 完还没更新导致读到空值
      await app.request('/album/settings', {
        method: 'PUT',
        headers: { ...asAdmin, 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: { images: 'https://x.com/a.jpg' } }),
      }, env);

      const res = await app.request('/album/settings', {
        method: 'GET',
        headers: asAdmin,
      }, env);

      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.data.values.images).toBe('https://x.com/a.jpg');
    });

    it('should return non-public settings to the admin settings page', async () => {
      // captions 不在 publicSettings 里（不下发给浏览器），
      // 但管理员设置页必须能看到它
      await app.request('/album/settings', {
        method: 'PUT',
        headers: { ...asAdmin, 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: { captions: '说明一|说明二' } }),
      }, env);

      const res = await app.request('/album/settings', {
        method: 'GET',
        headers: asAdmin,
      }, env);

      const body = await res.json() as any;
      expect(body.data.values.captions).toBe('说明一|说明二');
    });

    it('should reject unserializable values', async () => {
      // 嵌套对象塞进 config 会变成不可控结构
      const res = await app.request('/album/settings', {
        method: 'PUT',
        headers: { ...asAdmin, 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: { bad: { nested: true } } }),
      }, env);

      expect(res.status).toBe(400);
    });

    it('should reject a setting key containing a dot', async () => {
      // 键里有点号会与 {插件名}.{键} 的命名空间冲突
      const res = await app.request('/album/settings', {
        method: 'PUT',
        headers: { ...asAdmin, 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: { 'a.b': 'x' } }),
      }, env);

      expect(res.status).toBe(400);
    });
  });

  // ===== 启用状态如何影响钩子派发 =====

  describe('启用状态与钩子派发', () => {
    const input = {
      feedId: '1',
      content: 'x',
      userId: null,
      isLoggedIn: false,
      isAdmin: false,
    };

    it('should skip a disabled plugin when dispatching hooks', async () => {
      const calls: string[] = [];
      pluginRegistry.reset();
      pluginRegistry.register(
        makePlugin('off', {
          comment: {
            beforeCreate: () => {
              calls.push('off');
              return '不应被调用';
            },
          },
        }),
      );

      // 停用
      await serverConfig.set(ENABLED_KEY, '', true);
      await pluginRegistry.syncEnabledFromConfig(serverConfig);

      const result = await pluginRegistry.beforeCommentCreate(
        input,
        makePluginContext({ pluginName: 'off' }),
      );

      expect(calls).toHaveLength(0);
      expect(result).toBeUndefined();
    });

    it('should dispatch hooks for an enabled plugin', async () => {
      const calls: string[] = [];
      pluginRegistry.reset();
      pluginRegistry.register(
        makePlugin('on', {
          comment: {
            beforeCreate: () => {
              calls.push('on');
              return undefined;
            },
          },
        }),
      );

      await serverConfig.set(ENABLED_KEY, 'on', true);
      await pluginRegistry.syncEnabledFromConfig(serverConfig);

      await pluginRegistry.beforeCommentCreate(
        input,
        makePluginContext({ pluginName: 'on' }),
      );

      expect(calls).toEqual(['on']);
    });

    it('should treat an empty enabled list as everything disabled', async () => {
      // 管理员还没配置过时不该让插件自动全跑 ——
      // 新装一个插件就开始拦评论，不是预期行为
      pluginRegistry.reset();
      pluginRegistry.register(
        makePlugin('auto', {
          comment: { beforeCreate: () => '不该拦' },
        }),
      );

      await serverConfig.set(ENABLED_KEY, '', true);
      await pluginRegistry.syncEnabledFromConfig(serverConfig);

      const result = await pluginRegistry.beforeCommentCreate(
        input,
        makePluginContext({ pluginName: 'auto' }),
      );
      expect(result).toBeUndefined();
    });

    it('should ignore unknown names in the enabled list', async () => {
      // 配置里可能有已卸载的插件名，不该导致异常
      pluginRegistry.reset();
      pluginRegistry.register(makePlugin('real'));

      await serverConfig.set(ENABLED_KEY, 'real,ghost-plugin', true);
      await pluginRegistry.syncEnabledFromConfig(serverConfig);

      const enabled = pluginRegistry.enabled();
      expect(enabled).toHaveLength(1);
      expect(enabled[0].manifest.name).toBe('real');
    });

    it('should report synced state after syncEnabledFromConfig', async () => {
      pluginRegistry.reset();
      expect(pluginRegistry.hasSynced()).toBe(false);

      pluginRegistry.register(makePlugin('x'));
      await pluginRegistry.syncEnabledFromConfig(serverConfig);

      expect(pluginRegistry.hasSynced()).toBe(true);
    });

    it('should clear the synced state on reset', async () => {
      // 测试隔离的关键：reset 后不该沿用上一次的启用集合
      pluginRegistry.reset();
      pluginRegistry.register(makePlugin('x'));
      await serverConfig.set(ENABLED_KEY, 'x', true);
      await pluginRegistry.syncEnabledFromConfig(serverConfig);

      pluginRegistry.reset();
      expect(pluginRegistry.hasSynced()).toBe(false);

      pluginRegistry.register(makePlugin('x'));
      // 重新注册后默认应假设启用（未同步状态）
      expect(pluginRegistry.enabled()).toHaveLength(1);
    });
  });
});
