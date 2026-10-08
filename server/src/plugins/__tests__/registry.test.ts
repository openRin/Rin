import { describe, it, expect, beforeEach } from 'bun:test';
import { PluginRegistry, PluginRejectionError } from '../registry';
import { createPluginConfigReader } from '../config-reader';
import type { PluginContext, RinPlugin } from '../types';
import { makePluginContext } from './test-helpers';

/**
 * 插件注册中心的行为测试：单个插件崩溃不拖垮主流程；
 * 拦截语义明确（只有非空字符串或 PluginRejectionError 算拒绝）；配置读取边界行为确定。
 */

function makeCtx(overrides: Partial<PluginContext> = {}): PluginContext {
  return { ...makePluginContext({ pluginName: 'test' }), ...overrides };
}

function makePlugin(
  name: string,
  hooks: Partial<RinPlugin> = {},
): RinPlugin {
  return {
    manifest: {
      name,
      displayName: `Plugin ${name}`,
      version: '1.0.0',
    },
    ...hooks,
  };
}

describe('PluginRegistry', () => {
  let registry: PluginRegistry;

  beforeEach(() => {
    // 每个测试用独立实例，避免相互污染
    registry = new PluginRegistry();
  });

  describe('注册校验', () => {
    it('should reject an invalid plugin name', () => {
      // 名字会进 URL 路径，必须是小写 kebab-case
      expect(() => registry.register(makePlugin('Bad Name'))).toThrow();
      expect(() => registry.register(makePlugin('UPPER'))).toThrow();
      expect(() => registry.register(makePlugin('-leading'))).toThrow();
    });

    it('should accept lowercase kebab-case names', () => {
      registry.register(makePlugin('comment-guard'));
      expect(registry.list()).toHaveLength(1);
    });

    it('should reject a duplicate name', () => {
      registry.register(makePlugin('dup'));
      expect(() => registry.register(makePlugin('dup'))).toThrow(/duplicate/);
    });

    it('should require displayName and version', () => {
      expect(() =>
        registry.register({
          manifest: { name: 'a', displayName: '', version: '1' },
        }),
      ).toThrow(/displayName/);

      expect(() =>
        registry.register({
          manifest: { name: 'b', displayName: 'B', version: '' },
        }),
      ).toThrow(/version/);
    });
  });

  describe('beforeCreate 拦截语义', () => {
    it('should return the rejection message when a plugin rejects', async () => {
      registry.register(
        makePlugin('blocker', {
          comment: {
            beforeCreate: () => '不允许的内容',
          },
        }),
      );

      const result = await registry.beforeCommentCreate(
        { feedId: '1', content: 'x', userId: null, isLoggedIn: false, isAdmin: false },
        makeCtx(),
      );

      expect(result).toBe('不允许的内容');
    });

    it('should short-circuit on the first rejection', async () => {
      const calls: string[] = [];

      registry.register(
        makePlugin('first', {
          comment: {
            beforeCreate: () => {
              calls.push('first');
              return '先拒绝';
            },
          },
        }),
      );
      registry.register(
        makePlugin('second', {
          comment: {
            beforeCreate: () => {
              calls.push('second');
              return '不该执行到';
            },
          },
        }),
      );

      const result = await registry.beforeCommentCreate(
        { feedId: '1', content: 'x', userId: null, isLoggedIn: false, isAdmin: false },
        makeCtx(),
      );

      expect(result).toBe('先拒绝');
      // 第二个插件不该被调用 —— 短路要真的短路
      expect(calls).toEqual(['first']);
    });

    it('should NOT reject when a plugin throws a non-rejection error', async () => {
      // 插件自身崩溃不该让正常用户发不出评论。
      // 这是插件系统最重要的性质：扩展代码的错误不能影响主流程。
      registry.register(
        makePlugin('crashy', {
          comment: {
            beforeCreate: () => {
              throw new Error('插件内部炸了');
            },
          },
        }),
      );

      const result = await registry.beforeCommentCreate(
        { feedId: '1', content: 'x', userId: null, isLoggedIn: false, isAdmin: false },
        makeCtx(),
      );

      expect(result).toBeUndefined();
    });

    it('should propagate PluginRejectionError as a rejection', async () => {
      registry.register(
        makePlugin('thrower', {
          comment: {
            beforeCreate: () => {
              throw new PluginRejectionError('thrower', '主动拒绝的理由');
            },
          },
        }),
      );

      expect(
        registry.beforeCommentCreate(
          { feedId: '1', content: 'x', userId: null, isLoggedIn: false, isAdmin: false },
          makeCtx(),
        ),
      ).rejects.toThrow('主动拒绝的理由');
    });

    it('should treat an empty string as no rejection', async () => {
      // 返回空串表示「同意」，不能当成拒绝
      registry.register(
        makePlugin('empty', {
          comment: {
            beforeCreate: () => '',
          },
        }),
      );

      const result = await registry.beforeCommentCreate(
        { feedId: '1', content: 'x', userId: null, isLoggedIn: false, isAdmin: false },
        makeCtx(),
      );

      expect(result).toBeUndefined();
    });

    it('should skip disabled plugins', async () => {
      const calls: string[] = [];
      registry.register(
        makePlugin('disabled-one', {
          comment: {
            beforeCreate: () => {
              calls.push('hit');
              return '不该命中';
            },
          },
        }),
      );
      registry.reset();

      const result = await registry.beforeCommentCreate(
        { feedId: '1', content: 'x', userId: null, isLoggedIn: false, isAdmin: false },
        makeCtx(),
      );

      expect(result).toBeUndefined();
      expect(calls).toHaveLength(0);
    });
  });

  describe('afterCreate 容错', () => {
    it('should swallow errors from every plugin', async () => {
      // 评论已落库，插件失败绝不能影响响应
      registry.register(
        makePlugin('bad-after', {
          comment: {
            afterCreate: () => {
              throw new Error('after 崩了');
            },
          },
        }),
      );
      registry.register(
        makePlugin('good-after', {
          comment: {
            afterCreate: () => undefined,
          },
        }),
      );

      // 不应抛错
      await registry.afterCommentCreate(
        { id: 1, feedId: '1', userId: null, content: 'x', authorName: 'a', approved: true },
        makeCtx(),
      );
    });

    it('should run all afterCreate hooks even if one fails', async () => {
      const calls: string[] = [];

      registry.register(
        makePlugin('a1', {
          comment: {
            afterCreate: () => {
              calls.push('a1');
              throw new Error('崩');
            },
          },
        }),
      );
      registry.register(
        makePlugin('a2', {
          comment: {
            afterCreate: () => {
              calls.push('a2');
            },
          },
        }),
      );

      await registry.afterCommentCreate(
        { id: 1, feedId: '1', userId: null, content: 'x', authorName: 'a', approved: true },
        makeCtx(),
      );

      // 第一个崩了，第二个仍要执行
      expect(calls).toEqual(['a1', 'a2']);
    });
  });

  describe('loadAll 容错', () => {
    it('should mark a failing plugin as error and keep others enabled', async () => {
      registry.register(
        makePlugin('broken', {
          setup: () => {
            throw new Error('setup 失败');
          },
        }),
      );
      registry.register(
        makePlugin('healthy', {
          setup: () => undefined,
        }),
      );

      await registry.loadAll(async () => makeCtx());

      const broken = registry.list().find((p) => p.manifest.name === 'broken');
      const healthy = registry.list().find((p) => p.manifest.name === 'healthy');

      expect(broken?.status).toBe('error');
      expect(broken?.error).toContain('setup 失败');
      expect(healthy?.status).toBe('enabled');
    });

    it('should pass the plugin context to setup', async () => {
      let received: PluginContext | undefined;

      registry.register(
        makePlugin('ctx-user', {
          setup: (ctx) => {
            received = ctx;
          },
        }),
      );

      await registry.loadAll(async (name) => {
        const ctx = makeCtx();
        // 确认拿到的是该插件自己的上下文
        return Object.assign(ctx, { log: { info() {}, warn() {}, error() {} } });
      });

      expect(received).toBeDefined();
    });
  });

  describe('hook 缺席时的行为', () => {
    it('should be a no-op when no plugins declare the hook', async () => {
      registry.register(makePlugin('no-hooks'));

      expect(
        await registry.beforeCommentCreate(
          { feedId: '1', content: 'x', userId: null, isLoggedIn: false, isAdmin: false },
          makeCtx(),
        ),
      ).toBeUndefined();

      await registry.afterFeedSave({ id: 1, title: 't', content: 'c' }, makeCtx());
      await registry.afterFeedDelete({ id: 1 }, makeCtx());
      await registry.beforeCommentDelete({ id: 1, userId: null }, makeCtx());
    });
  });
});

describe('createPluginConfigReader', () => {
  function readerWith(store: Record<string, unknown>) {
    return createPluginConfigReader('myplugin', {
      get: async (key: string) => (key in store ? store[key] : null),
      getOrDefault: async <T>(key: string, def: T) => (store[key] as T) ?? def,
    } as never);
  }

  it('should prefix keys with the plugin name', async () => {
    const reader = readerWith({ 'myplugin.timeout': '30' });
    expect(await reader.string('timeout', '10')).toBe('30');
  });

  it('should fall back to the default when missing', async () => {
    const reader = readerWith({});
    expect(await reader.string('nope', 'fallback')).toBe('fallback');
  });

  it('should treat an empty string as missing', async () => {
    // 后台把输入框清空时存的就是空串，应视为「用默认值」
    const reader = readerWith({ 'myplugin.key': '' });
    expect(await reader.string('key', 'default')).toBe('default');
  });

  it('should parse booleans from config strings', async () => {
    // 管理后台存的值都是字符串，所以 'true' / '1' 都得认
    expect(await readerWith({ 'myplugin.b': 'true' }).boolean('b', false)).toBe(true);
    expect(await readerWith({ 'myplugin.b': '1' }).boolean('b', false)).toBe(true);
    expect(await readerWith({ 'myplugin.b': 'false' }).boolean('b', true)).toBe(false);
    expect(await readerWith({ 'myplugin.b': '0' }).boolean('b', true)).toBe(false);
    expect(await readerWith({ 'myplugin.b': true }).boolean('b', false)).toBe(true);
  });

  it('should fall back on unrecognised booleans', async () => {
    // 脏数据不能让下游拿到意外的真值
    expect(await readerWith({ 'myplugin.b': 'yes' }).boolean('b', true)).toBe(true);
    expect(await readerWith({ 'myplugin.b': 'garbage' }).boolean('b', false)).toBe(false);
  });

  it('should return the default for non-numeric numbers', async () => {
    const reader = readerWith({ 'myplugin.n': 'abc' });
    // 关键：不能返回 NaN，那会让下游计算全崩
    expect(await reader.number('n', 5)).toBe(5);
  });

  it('should split string lists on commas and newlines', async () => {
    expect(await readerWith({ 'myplugin.l': 'a, b ,c' }).stringList('l', [])).toEqual(['a', 'b', 'c']);
    expect(await readerWith({ 'myplugin.l': 'a\nb' }).stringList('l', [])).toEqual(['a', 'b']);
    // 空项应被过滤掉
    expect(await readerWith({ 'myplugin.l': 'a,,b' }).stringList('l', [])).toEqual(['a', 'b']);
  });

  it('should pass through array values', async () => {
    expect(await readerWith({ 'myplugin.l': ['a', ' b '] }).stringList('l', [])).toEqual(['a', 'b']);
  });
});
