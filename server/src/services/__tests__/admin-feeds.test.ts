import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import type { Database } from 'bun:sqlite';
import { setupTestApp, cleanupTestDB, seedTestData } from '../../../tests/fixtures';
import { AdminFeedsService } from '../admin-feeds';

/**
 * 管理员文章统一管理：列表含草稿、批量删除（含 missing 回报）、管理员校验。
 * seedTestData 建的是：user1（普通）、user2（管理员）、feed 1/2（已发布）、
 * feed 1 两条评论、feed_hashtags 关联若干。
 */
describe('AdminFeedsService', () => {
  let sqlite: Database;
  let env: Env;
  let app: any;

  beforeEach(async () => {
    const ctx = await setupTestApp(AdminFeedsService);
    sqlite = ctx.sqlite;
    env = ctx.env;
    app = ctx.app;

    await seedTestData(sqlite);

    // 追加一篇草稿与一条 visit_stats，用于列表与 pv 断言。
    // 注意：mock 库的 feeds.id 目前是 INTEGER，生产库是 TEXT（uuid），
    // 所以用数字文本 id，并在断言时统一 String()，两种存储形态都能跑。
    sqlite.exec(`
        INSERT INTO feeds (id, title, content, uid, draft, listed, summary) VALUES
            ('5', 'Draft Post', 'secret content', 1, 1, 0, 'draft summary')
    `);
    sqlite.exec(`
        INSERT INTO visit_stats (feed_id, pv) VALUES (1, 42)
    `);
  });

  afterEach(() => {
    cleanupTestDB(sqlite);
  });

  const asAdmin = { Authorization: 'Bearer mock_token_2' };
  const asUser = { Authorization: 'Bearer mock_token_1' };

  // ===== 列表 =====

  describe('GET /feeds', () => {
    it('should reject an anonymous caller', async () => {
      // requireAdmin 统一抛 403（匿名与已登录非管理员同口径）
      const res = await app.request('/feeds', { method: 'GET' }, env);
      expect(res.status).toBe(403);
    });

    it('should reject a non-admin caller with 403', async () => {
      const res = await app.request('/feeds', { method: 'GET', headers: asUser }, env);
      expect(res.status).toBe(403);
    });

    it('should list all feeds including drafts with counts', async () => {
      const res = await app.request('/feeds?page=1&size=20', { method: 'GET', headers: asAdmin }, env);
      expect(res.status).toBe(200);

      const body = await res.json() as any;
      expect(body.pagination.total).toBe(3);

      const ids = body.feeds.map((f: any) => f.id);
      expect(ids.map(String)).toContain('1');
      expect(ids.map(String)).toContain('2');
      // 草稿也在列表里
      expect(ids.map(String)).toContain('5');

      const draft = body.feeds.find((f: any) => String(f.id) === '5');
      expect(draft.draft).toBe(1);
      expect(draft.listed).toBe(0);

      const feed1 = body.feeds.find((f: any) => String(f.id) === '1');
      expect(feed1.commentCount).toBe(2);
      expect(feed1.pv).toBe(42);
    });

    it('should filter by keyword on title or alias with escaping', async () => {
      const res = await app.request('/feeds?keyword=Draft', { method: 'GET', headers: asAdmin }, env);
      const body = await res.json() as any;
      expect(body.pagination.total).toBe(1);
      expect(String(body.feeds[0].id)).toBe('5');

      // % 按字面匹配，不应命中任何行
      const wildcard = await app.request('/feeds?keyword=%', { method: 'GET', headers: asAdmin }, env);
      const wildcardBody = await wildcard.json() as any;
      expect(wildcardBody.pagination.total).toBe(0);
    });
  });

  // ===== 批量删除 =====

  describe('POST /feeds/batch-delete', () => {
    it('should reject a non-admin caller with 403', async () => {
      const res = await app.request('/feeds/batch-delete', {
        method: 'POST',
        headers: { ...asUser, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: ['1'] }),
      }, env);
      expect(res.status).toBe(403);
    });

    it('should reject an empty or malformed ids payload', async () => {
      for (const body of ['{}', '{"ids":[]}', '{"ids":"1"}', '{"ids":[1,2]}', 'not json']) {
        const res = await app.request('/feeds/batch-delete', {
          method: 'POST',
          headers: { ...asAdmin, 'Content-Type': 'application/json' },
          body,
        }, env);
        expect(res.status).toBe(400);
      }
    });

    it('should delete feeds with child rows and report missing ids', async () => {
      const res = await app.request('/feeds/batch-delete', {
        method: 'POST',
        headers: { ...asAdmin, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: ['1', '5', 'no-such-id'] }),
      }, env);
      expect(res.status).toBe(200);

      const body = await res.json() as any;
      expect(body.deleted).toBe(2);
      expect(body.missing).toEqual(['no-such-id']);

      // 文章本身已删
      const feedCount = sqlite.query('select count(*) as n from feeds').get() as any;
      expect(feedCount.n).toBe(1);

      // 子表必须清干净（不依赖外键 cascade 是否生效）
      const commentCount = sqlite.query("select count(*) as n from comments where feed_id in ('1','5')").get() as any;
      expect(commentCount.n).toBe(0);

      const hashtagCount = sqlite.query("select count(*) as n from feed_hashtags where feed_id in ('1','5')").get() as any;
      expect(hashtagCount.n).toBe(0);

      const statsCount = sqlite.query("select count(*) as n from visit_stats where feed_id in ('1','5')").get() as any;
      expect(statsCount.n).toBe(0);
    });

    it('should return deleted 0 with all ids missing when nothing matches', async () => {
      const res = await app.request('/feeds/batch-delete', {
        method: 'POST',
        headers: { ...asAdmin, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: ['ghost-1', 'ghost-2'] }),
      }, env);
      expect(res.status).toBe(200);

      const body = await res.json() as any;
      expect(body.deleted).toBe(0);
      expect(body.missing).toEqual(['ghost-1', 'ghost-2']);
      expect((sqlite.query('select count(*) as n from feeds').get() as any).n).toBe(3);
    });
  });
});
