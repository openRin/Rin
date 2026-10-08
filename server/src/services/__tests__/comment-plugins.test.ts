import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { setupTestApp, cleanupTestDB } from '../../../tests/fixtures';
import { CommentService } from '../comments';
import { pluginRegistry } from '../../plugins/registry';
import { makePluginContext } from '../../plugins/__tests__/test-helpers';
import type { RinPlugin } from '../../plugins/types';

/**
 * 端到端验证：插件钩子真的接进了评论流程（registry 单测只证明派发逻辑正确，
 * 改错 comments.ts 的插入位置只有这类测试能发现）。
 */
describe('comment plugin integration', () => {
  let sqlite: any;
  let env: Env;
  let app: any;
  let serverConfig: any;

  beforeEach(async () => {
    const ctx = await setupTestApp(CommentService);
    sqlite = ctx.sqlite;
    env = ctx.env;
    app = ctx.app;
    serverConfig = ctx.serverConfig;

    sqlite.exec(`
      INSERT INTO users (id, username, avatar, permission, openid)
      VALUES (1, 'user1', 'a.png', 0, 'gh_1');
      INSERT INTO feeds (id, title, content, uid, draft, listed)
      VALUES (1, 'Test Feed', 'body', 1, 0, 1);
    `);

    pluginRegistry.reset();
  });

  afterEach(() => {
    pluginRegistry.reset();
    cleanupTestDB(sqlite);
  });

  /** 注册一个测试插件 */
  function registerPlugin(plugin: Partial<RinPlugin> & { name: string }) {
    pluginRegistry.register({
      manifest: {
        name: plugin.name,
        displayName: plugin.name,
        version: '1.0.0',
      },
      ...plugin,
    } as RinPlugin);
  }

  /** 构造一次游客评论请求 */
  function guestRequest(content: string) {
    return app.request('/1', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': '203.0.113.10',
      },
      body: JSON.stringify({
        content,
        guestName: 'Tester',
        guestEmail: 'tester@example.com',
      }),
    }, env);
  }

  it('should let a comment through when no plugin rejects it', async () => {
    registerPlugin({
      name: 'pass-through',
      comment: { beforeCreate: () => undefined },
    });

    const res = await guestRequest('正常评论');
    expect(res.status).toBe(201);
  });

  it('should reject the comment when a plugin returns a message', async () => {
    registerPlugin({
      name: 'blocker',
      comment: { beforeCreate: () => '这里不让发' },
    });

    const res = await guestRequest('会被拦截的评论');
    expect(res.status).toBe(400);

    const body = await res.json() as any;
    expect(body.error.message).toBe('这里不让发');

    // 关键：被拦截的评论不能留在库里
    const count = sqlite
      .prepare("SELECT COUNT(*) as c FROM comments WHERE content = '会被拦截的评论'")
      .get() as any;
    expect(count.c).toBe(0);
  });

  it('should pass the comment input fields to the hook', async () => {
    let received: any;

    registerPlugin({
      name: 'inspector',
      comment: {
        beforeCreate: (input) => {
          received = input;
          return undefined;
        },
      },
    });

    await guestRequest('检查输入字段');

    expect(received).toBeDefined();
    expect(received.feedId).toBe('1');
    expect(received.content).toBe('检查输入字段');
    expect(received.userId).toBeNull();
    expect(received.guestName).toBe('Tester');
    expect(received.isLoggedIn).toBe(false);
    expect(received.isAdmin).toBe(false);
  });

  it('should call afterCreate with the created comment', async () => {
    let received: any;

    registerPlugin({
      name: 'after-listener',
      comment: {
        afterCreate: (comment) => {
          received = comment;
        },
      },
    });

    const res = await guestRequest('触发 after');
    expect(res.status).toBe(201);

    expect(received).toBeDefined();
    expect(typeof received.id).toBe('number');
    expect(received.feedId).toBe('1');
    expect(received.content).toBe('触发 after');
    expect(received.authorName).toBe('Tester');
  });

  it('should not fail the request when afterCreate throws', async () => {
    // 评论已落库，插件在 after 崩了也不能让用户看到失败
    registerPlugin({
      name: 'after-crash',
      comment: {
        afterCreate: () => {
          throw new Error('after 阶段崩了');
        },
      },
    });

    const res = await guestRequest('评论仍应成功');
    expect(res.status).toBe(201);

    const count = sqlite
      .prepare("SELECT COUNT(*) as c FROM comments WHERE content = '评论仍应成功'")
      .get() as any;
    expect(count.c).toBe(1);
  });

  it('should not fail the request when beforeCreate throws a plain error', async () => {
    // 插件自身崩溃（而非主动拒绝）不该阻断用户
    registerPlugin({
      name: 'before-crash',
      comment: {
        beforeCreate: () => {
          throw new Error('插件内部错误');
        },
      },
    });

    const res = await guestRequest('评论应通过');
    expect(res.status).toBe(201);
  });

  it('should run multiple plugins in registration order', async () => {
    const order: string[] = [];

    registerPlugin({
      name: 'first',
      comment: {
        beforeCreate: () => {
          order.push('first');
          return undefined;
        },
      },
    });
    registerPlugin({
      name: 'second',
      comment: {
        beforeCreate: () => {
          order.push('second');
          return undefined;
        },
      },
    });

    await guestRequest('多插件');
    expect(order).toEqual(['first', 'second']);
  });

  it('should short-circuit so later plugins are not called after a rejection', async () => {
    const order: string[] = [];

    registerPlugin({
      name: 'rejecter',
      comment: {
        beforeCreate: () => {
          order.push('rejecter');
          return '已拒绝';
        },
      },
    });
    registerPlugin({
      name: 'never-runs',
      comment: {
        beforeCreate: () => {
          order.push('never-runs');
          return undefined;
        },
      },
    });

    const res = await guestRequest('短路测试');
    expect(res.status).toBe(400);
    expect(order).toEqual(['rejecter']);
  });
});

describe('comment-guard 示例插件', () => {
  let sqlite: any;
  let env: Env;
  let app: any;

  beforeEach(async () => {
    const ctx = await setupTestApp(CommentService);
    sqlite = ctx.sqlite;
    env = ctx.env;
    app = ctx.app;

    sqlite.exec(`
      INSERT INTO users (id, username, avatar, permission, openid)
      VALUES (1, 'user1', 'a.png', 0, 'gh_1');
      INSERT INTO feeds (id, title, content, uid, draft, listed)
      VALUES (1, 'Test Feed', 'body', 1, 0, 1);
    `);

    pluginRegistry.reset();
  });

  afterEach(() => {
    pluginRegistry.reset();
    cleanupTestDB(sqlite);
  });

  it('should block comments containing a configured word', async () => {
    // 直接复用示例插件，验证它开箱可用；注入带词表的 serverConfig，直接测钩子本身
    const commentGuard = (await import('../../../plugins/comment-guard')).default;

    const ctx = makePluginContext({
      pluginName: 'comment-guard',
      values: {
        'comment-guard.blockedWords': '违禁词,另一个词',
        'comment-guard.enabled': true,
      },
    });

    pluginRegistry.register(commentGuard);

    const rejection = await pluginRegistry.beforeCommentCreate(
      { feedId: '1', content: '这里有违禁词哦', userId: null, isLoggedIn: false, isAdmin: false },
      ctx,
    );

    expect(typeof rejection).toBe('string');
    expect(rejection).toContain('违禁词');
  });

  it('should let clean comments through', async () => {
    const commentGuard = (await import('../../../plugins/comment-guard')).default;

    const ctx = makePluginContext({
      pluginName: 'comment-guard',
      values: { 'comment-guard.blockedWords': '违禁词' },
    });

    pluginRegistry.register(commentGuard);

    const rejection = await pluginRegistry.beforeCommentCreate(
      { feedId: '1', content: '干净的评论内容', userId: null, isLoggedIn: false, isAdmin: false },
      ctx,
    );

    expect(rejection).toBeUndefined();
  });
});
