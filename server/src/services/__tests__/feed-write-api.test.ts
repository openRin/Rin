import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import type { Database } from 'bun:sqlite';
import { setupTestApp, cleanupTestDB } from '../../../tests/fixtures';
import { FeedWriteApiService } from '../feed-write-api';

/**
 * 文章写入 API 测试，重点是管理员权限边界（一个鉴权漏洞就能让任何人塞文章）。
 */
describe('FeedWriteApiService', () => {
  let sqlite: Database;
  let env: Env;
  let app: any;
  let clientConfig: any;

  beforeEach(async () => {
    const ctx = await setupTestApp(FeedWriteApiService);
    sqlite = ctx.sqlite;
    env = ctx.env;
    app = ctx.app;
    clientConfig = ctx.clientConfig;

    // user1=普通用户, admin=管理员
    sqlite.exec(`
      INSERT INTO users (id, username, avatar, permission, openid) VALUES
        (1, 'user1', 'a.png', 0, 'gh_1'),
        (2, 'admin', 'b.png', 1, 'admin:root')
    `);
  });

  afterEach(() => {
    cleanupTestDB(sqlite);
  });

  const asAdmin = { Authorization: 'Bearer mock_token_2' };
  const asUser = { Authorization: 'Bearer mock_token_1' };

  const createBody = (overrides: Record<string, unknown> = {}) => ({
    title: 'API 创建的文章',
    content: '正文内容',
    draft: false,
    listed: true,
    tags: [],
    ...overrides,
  });

  // ===== 鉴权边界 =====

  describe('管理员权限', () => {
    it('should reject an anonymous caller with 401', async () => {
      const res = await app.request('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createBody()),
      }, env);

      expect(res.status).toBe(401);
      const body = await res.json() as any;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('AUTH_LOGIN_REQUIRED');
    });

    it('should reject a non-admin user with 403', async () => {
      // 已登录但 permission !== 1 —— 这是最关键的一条
      const res = await app.request('/', {
        method: 'POST',
        headers: { ...asUser, 'Content-Type': 'application/json' },
        body: JSON.stringify(createBody()),
      }, env);

      expect(res.status).toBe(403);
      const body = await res.json() as any;
      expect(body.error.code).toBe('FEED_PERMISSION_DENIED');
    });

    it('should reject a non-admin caller on update and delete too', async () => {
      sqlite.exec(`
        INSERT INTO feeds (id, title, content, uid, draft, listed)
        VALUES (1, 'Existing', 'body', 2, 0, 1)
      `);

      const put = await app.request('/1', {
        method: 'PUT',
        headers: { ...asUser, 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: '被篡改' }),
      }, env);
      expect(put.status).toBe(403);

      const del = await app.request('/1?confirm=1', {
        method: 'DELETE',
        headers: asUser,
      }, env);
      expect(del.status).toBe(403);

      // 文章必须还在
      const row = sqlite.prepare('SELECT title FROM feeds WHERE id = 1').get() as any;
      expect(row.title).toBe('Existing');
    });

    it('should not create anything for a rejected caller', async () => {
      await app.request('/', {
        method: 'POST',
        headers: { ...asUser, 'Content-Type': 'application/json' },
        body: JSON.stringify(createBody()),
      }, env);

      const count = sqlite.prepare('SELECT COUNT(*) as c FROM feeds').get() as any;
      expect(count.c).toBe(0);
    });
  });

  // ===== 创建文章 =====

  describe('POST / 创建文章', () => {
    it('should create an article for an admin', async () => {
      const res = await app.request('/', {
        method: 'POST',
        headers: { ...asAdmin, 'Content-Type': 'application/json' },
        body: JSON.stringify(createBody()),
      }, env);

      expect(res.status).toBe(201);
      const body = await res.json() as any;
      expect(body.success).toBe(true);
      expect(body.data.created).toBe(true);
      // feeds.id 为文本主键（uuid 或数字文本）
      expect(typeof body.data.id).toBe('string');

      const row = sqlite.prepare('SELECT * FROM feeds WHERE id = ?').get(body.data.id) as any;
      expect(row.title).toBe('API 创建的文章');
      expect(row.uid).toBe(2);
    });

    it('should honour draft and listed flags', async () => {
      const res = await app.request('/', {
        method: 'POST',
        headers: { ...asAdmin, 'Content-Type': 'application/json' },
        body: JSON.stringify(createBody({ draft: true, listed: false })),
      }, env);

      const body = await res.json() as any;
      const row = sqlite.prepare('SELECT * FROM feeds WHERE id = ?').get(body.data.id) as any;
      expect(row.draft).toBe(1);
      expect(row.listed).toBe(0);
    });

    it('should reject a duplicate article with 409', async () => {
      sqlite.exec(`
        INSERT INTO feeds (id, title, content, uid, draft, listed)
        VALUES (1, '重复的', '同样的内容', 2, 0, 1)
      `);

      const res = await app.request('/', {
        method: 'POST',
        headers: { ...asAdmin, 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: '重复的', content: '同样的内容', draft: false, listed: true, tags: [] }),
      }, env);

      expect(res.status).toBe(409);
      const body = await res.json() as any;
      expect(body.error.code).toBe('FEED_ALREADY_EXISTS');
    });

    it('should return a structured error for a missing title', async () => {
      const res = await app.request('/', {
        method: 'POST',
        headers: { ...asAdmin, 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: '有内容但没标题', draft: false, listed: true, tags: [] }),
      }, env);

      expect(res.status).toBe(400);
      const body = await res.json() as any;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('FEED_VALIDATION_FAILED');
      // message 是字符串而不是数组，脚本可以直接打印
      expect(typeof body.error.message).toBe('string');
    });

    it('should return a structured error for malformed JSON', async () => {
      const res = await app.request('/', {
        method: 'POST',
        headers: { ...asAdmin, 'Content-Type': 'application/json' },
        body: '{ this is not json',
      }, env);

      expect(res.status).toBe(400);
      const body = await res.json() as any;
      expect(body.success).toBe(false);
    });
  });

  // ===== dryRun =====

  describe('dryRun 试运行', () => {
    it('should validate without writing when dryRun is true', async () => {
      const res = await app.request('/', {
        method: 'POST',
        headers: { ...asAdmin, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...createBody(), dryRun: true }),
      }, env);

      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.data.dryRun).toBe(true);
      expect(body.data.created).toBe(false);
      expect(body.data.wouldCreate.title).toBe('API 创建的文章');

      // 关键：一条都不能写进库
      const count = sqlite.prepare('SELECT COUNT(*) as c FROM feeds').get() as any;
      expect(count.c).toBe(0);
    });

    it('should not persist dryRun as an article field', async () => {
      // dryRun 是控制字段，不能被当成文章内容存进去
      await app.request('/', {
        method: 'POST',
        headers: { ...asAdmin, 'Content-Type': 'application/json' },
        body: JSON.stringify(createBody()),
      }, env);

      const row = sqlite.prepare('SELECT * FROM feeds LIMIT 1').get() as any;
      expect(Object.keys(row)).not.toContain('dryRun');
    });

    it('should still report a conflict during dryRun', async () => {
      // 调用方在试运行时也需要知道会冲突，否则白跑一趟真实请求
      sqlite.exec(`
        INSERT INTO feeds (id, title, content, uid, draft, listed)
        VALUES (1, '冲突的', '内容', 2, 0, 1)
      `);

      const res = await app.request('/', {
        method: 'POST',
        headers: { ...asAdmin, 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: '冲突的', content: '内容', draft: false, listed: true, tags: [], dryRun: true }),
      }, env);

      expect(res.status).toBe(409);
    });

    it('should support dryRun on update', async () => {
      sqlite.exec(`
        INSERT INTO feeds (id, title, content, uid, draft, listed)
        VALUES (1, '原标题', '原内容', 2, 0, 1)
      `);

      const res = await app.request('/1', {
        method: 'PUT',
        headers: { ...asAdmin, 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: '新标题', dryRun: true }),
      }, env);

      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.data.updated).toBe(false);
      expect(body.data.wouldUpdate.title).toBe('新标题');

      const row = sqlite.prepare('SELECT title FROM feeds WHERE id = 1').get() as any;
      expect(row.title).toBe('原标题');
    });
  });

  // ===== 更新文章 =====

  describe('PUT /:id 更新文章', () => {
    beforeEach(() => {
      sqlite.exec(`
        INSERT INTO feeds (id, title, content, uid, draft, listed)
        VALUES (1, '原标题', '原内容', 2, 0, 1)
      `);
    });

    it('should update the title', async () => {
      const res = await app.request('/1', {
        method: 'PUT',
        headers: { ...asAdmin, 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: '新标题' }),
      }, env);

      expect(res.status).toBe(200);
      const row = sqlite.prepare('SELECT title FROM feeds WHERE id = 1').get() as any;
      expect(row.title).toBe('新标题');
    });

    it('should leave unspecified fields untouched', async () => {
      // 只传 title，content 不该被清空 ——
      // 用 `|| ''` 兜底会把「未传」和「传空」混为一谈
      await app.request('/1', {
        method: 'PUT',
        headers: { ...asAdmin, 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: '只改标题' }),
      }, env);

      const row = sqlite.prepare('SELECT * FROM feeds WHERE id = 1').get() as any;
      expect(row.content).toBe('原内容');
      expect(row.listed).toBe(1);
    });

    it('should return 404 for a missing article', async () => {
      const res = await app.request('/9999', {
        method: 'PUT',
        headers: { ...asAdmin, 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'x' }),
      }, env);

      expect(res.status).toBe(404);
      const body = await res.json() as any;
      expect(body.error.code).toBe('FEED_NOT_FOUND');
    });

    it('should reject an invalid id', async () => {
      // id 均按字符串处理：任意非空 id 若不存在，统一按未命中返回 404
      const res = await app.request('/abc', {
        method: 'PUT',
        headers: { ...asAdmin, 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'x' }),
      }, env);

      expect(res.status).toBe(404);
      const body = await res.json() as any;
      expect(body.error.code).toBe('FEED_NOT_FOUND');
    });
  });

  // ===== 删除文章 =====

  describe('DELETE /:id 删除文章', () => {
    beforeEach(() => {
      sqlite.exec(`
        INSERT INTO feeds (id, title, content, uid, draft, listed)
        VALUES (1, '待删除', '内容', 2, 0, 1)
      `);
    });

    it('should require an explicit confirm parameter', async () => {
      // 不带 confirm 直接删太危险 —— 脚本传错 id 就永久丢文章
      const res = await app.request('/1', {
        method: 'DELETE',
        headers: asAdmin,
      }, env);

      expect(res.status).toBe(400);
      const body = await res.json() as any;
      expect(body.error.message).toContain('confirm=1');

      const count = sqlite.prepare('SELECT COUNT(*) as c FROM feeds WHERE id = 1').get() as any;
      expect(count.c).toBe(1);
    });

    it('should reject a confirm value that does not match the id', async () => {
      const res = await app.request('/1?confirm=2', {
        method: 'DELETE',
        headers: asAdmin,
      }, env);

      expect(res.status).toBe(400);
      const count = sqlite.prepare('SELECT COUNT(*) as c FROM feeds WHERE id = 1').get() as any;
      expect(count.c).toBe(1);
    });

    it('should delete when confirm matches', async () => {
      const res = await app.request('/1?confirm=1', {
        method: 'DELETE',
        headers: asAdmin,
      }, env);

      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.data.deleted).toBe(true);

      const count = sqlite.prepare('SELECT COUNT(*) as c FROM feeds WHERE id = 1').get() as any;
      expect(count.c).toBe(0);
    });
  });

  // ===== 读取 =====

  describe('GET /:id 读取文章', () => {
    it('should return the article for an admin', async () => {
      sqlite.exec(`
        INSERT INTO feeds (id, title, content, uid, draft, listed)
        VALUES (1, '读取我', '内容', 2, 0, 1)
      `);

      const res = await app.request('/1', { method: 'GET', headers: asAdmin }, env);

      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.success).toBe(true);
      expect(body.data.title).toBe('读取我');
    });

    it('should reject a non-admin reader', async () => {
      const res = await app.request('/1', { method: 'GET', headers: asUser }, env);
      expect(res.status).toBe(403);
    });

    it('should return 404 for a missing article', async () => {
      const res = await app.request('/9999', { method: 'GET', headers: asAdmin }, env);
      expect(res.status).toBe(404);
    });
  });

  // ===== 响应格式一致性 =====

  describe('响应格式', () => {
    it('should always include a success field', async () => {
      // 脚本靠这个字段判断成败，不能有时有、有时没有
      const cases = [
        await app.request('/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(createBody()),
        }, env),
        await app.request('/', {
          method: 'POST',
          headers: { ...asUser, 'Content-Type': 'application/json' },
          body: JSON.stringify(createBody()),
        }, env),
        await app.request('/', {
          method: 'POST',
          headers: { ...asAdmin, 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: '' }),
        }, env),
      ];

      for (const res of cases) {
        const body = await res.json() as any;
        expect(typeof body.success).toBe('boolean');
        if (!body.success) {
          expect(typeof body.error.code).toBe('string');
          expect(typeof body.error.message).toBe('string');
        }
      }
    });

    it('should not leak a stack trace in error messages', async () => {
      const res = await app.request('/', {
        method: 'POST',
        headers: { ...asAdmin, 'Content-Type': 'application/json' },
        body: '{ broken',
      }, env);

      const body = await res.json() as any;
      expect(body.error.message).not.toContain('at ');
      expect(body.error.message).not.toContain('.ts:');
    });
  });
});
