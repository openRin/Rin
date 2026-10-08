import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import type { Database } from 'bun:sqlite';
import { setupTestApp, cleanupTestDB } from '../../../tests/fixtures';
import { FeedWriteApiService } from '../feed-write-api';

/**
 * 按 docs/feed-write-api.md 的用法逐条验证：文档示例与实现不一致时立刻失败。
 */
describe('文档示例与实现的一致性', () => {
  let sqlite: Database;
  let env: Env;
  let app: any;

  beforeEach(async () => {
    const ctx = await setupTestApp(FeedWriteApiService);
    sqlite = ctx.sqlite;
    env = ctx.env;
    app = ctx.app;

    sqlite.exec(`
      INSERT INTO users (id, username, avatar, permission, openid) VALUES
        (2, 'admin', 'b.png', 1, 'admin:root')
    `);
  });

  afterEach(() => {
    cleanupTestDB(sqlite);
  });

  const admin = { Authorization: 'Bearer mock_token_2' };
  const json = { 'Content-Type': 'application/json' };

  it('文档里的 dryRun 示例：应返回 wouldCreate 且不写库', async () => {
    // 文档：body 为 {title,content,draft,listed,tags,dryRun:true}
    const res = await app.request('/', {
      method: 'POST',
      headers: { ...admin, ...json },
      body: JSON.stringify({
        title: '标题',
        content: '内容',
        draft: false,
        listed: true,
        tags: [],
        dryRun: true,
      }),
    }, env);

    const body = await res.json() as any;
    // 文档写的响应结构
    expect(body.data.dryRun).toBe(true);
    expect(body.data.created).toBe(false);
    expect(body.data.wouldCreate).toBeDefined();
    expect((await sqlite.prepare('SELECT COUNT(*) as c FROM feeds').get() as any).c).toBe(0);
  });

  it('文档里的正式创建示例：响应字段应与文档一致', async () => {
    // 文档写的是 {created, id, url, title, draft}
    const res = await app.request('/', {
      method: 'POST',
      headers: { ...admin, ...json },
      body: JSON.stringify({
        title: '标题',
        content: '内容',
        draft: false,
        listed: true,
        tags: [],
      }),
    }, env);

    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(Object.keys(body.data).sort()).toEqual(
      ['created', 'dryRun', 'draft', 'id', 'title', 'url'].sort(),
    );
    expect(body.data.dryRun).toBe(false);
    expect(body.data.url).toBe(`/feed/${body.data.id}`);
  });

  it('文档说 url 在有 alias 时用 /post/ 前缀，应属实', async () => {
    const res = await app.request('/', {
      method: 'POST',
      headers: { ...admin, ...json },
      body: JSON.stringify({
        title: '带别名的',
        content: '内容',
        alias: 'my-alias',
        draft: false,
        listed: true,
        tags: [],
      }),
    }, env);

    const body = await res.json() as any;
    expect(body.data.url).toBe('/post/my-alias');
  });

  it('文档说失败响应是 {success:false,error:{code,message}}，应属实', async () => {
    const res = await app.request('/', {
      method: 'POST',
      headers: { ...admin, ...json },
      body: JSON.stringify({ title: '' }),
    }, env);

    const body = await res.json() as any;
    expect(Object.keys(body)).toEqual(['success', 'error']);
    expect(Object.keys(body.error).sort()).toEqual(['code', 'message']);
  });

  it('文档说更新只需带 title，不传即不改', async () => {
    sqlite.exec(`
      INSERT INTO feeds (id, title, content, uid, draft, listed)
      VALUES (42, '原标题', '原内容', 2, 0, 1)
    `);

    // 文档示例只传 title
    const res = await app.request('/42', {
      method: 'PUT',
      headers: { ...admin, ...json },
      body: JSON.stringify({ title: '改过的标题' }),
    }, env);

    expect(res.status).toBe(200);
    const row = sqlite.prepare('SELECT * FROM feeds WHERE id = 42').get() as any;
    expect(row.title).toBe('改过的标题');
    expect(row.content).toBe('原内容');
  });

  it('文档说删除要带 ?confirm=<id> 且值一致', async () => {
    sqlite.exec(`
      INSERT INTO feeds (id, title, content, uid, draft, listed)
      VALUES (42, '待删除', '内容', 2, 0, 1)
    `);

    // 不带 confirm → 400
    const noConfirm = await app.request('/42', { method: 'DELETE', headers: admin }, env);
    expect(noConfirm.status).toBe(400);

    // confirm 不匹配 → 400
    const mismatch = await app.request('/42?confirm=999', { method: 'DELETE', headers: admin }, env);
    expect(mismatch.status).toBe(400);

    // 一致 → 成功
    const ok = await app.request('/42?confirm=42', { method: 'DELETE', headers: admin }, env);
    expect(ok.status).toBe(200);
  });

  it('文档的错误码表要与实现一致', async () => {
    // 逐个触发文档里列的错误码
    const cases: Array<[Request, number, string]> = [
      // 401 AUTH_LOGIN_REQUIRED
      [
        new Request('http://x/', { method: 'POST' }),
        401,
        'AUTH_LOGIN_REQUIRED',
      ],
      // 400 FEED_VALIDATION_FAILED
      [
        new Request('http://x/', {
          method: 'POST',
          headers: { ...admin, ...json },
          body: JSON.stringify({ title: '' }),
        }),
        400,
        'FEED_VALIDATION_FAILED',
      ],
      // 404 FEED_NOT_FOUND
      [
        new Request('http://x/9999', {
          method: 'PUT',
          headers: { ...admin, ...json },
          body: JSON.stringify({ title: 'x' }),
        }),
        404,
        'FEED_NOT_FOUND',
      ],
    ];

    for (const [request, expectedStatus, expectedCode] of cases) {
      const res = await app.fetch(request, env);
      expect(res.status).toBe(expectedStatus);
      const body = await res.json() as any;
      expect(body.error.code).toBe(expectedCode);
    }
  });

  it('文档说 tags 传数组，应能正确写入', async () => {
    const res = await app.request('/', {
      method: 'POST',
      headers: { ...admin, ...json },
      body: JSON.stringify({
        title: '带标签',
        content: '内容',
        draft: false,
        listed: true,
        tags: ['随笔', '日记'],
      }),
    }, env);

    expect(res.status).toBe(201);
    const id = (await res.json() as any).data.id;
    const rows = sqlite
      .prepare('SELECT hashtag_id FROM feed_hashtags WHERE feed_id = ?')
      .all(id) as any[];
    expect(rows.length).toBe(2);
  });
});
