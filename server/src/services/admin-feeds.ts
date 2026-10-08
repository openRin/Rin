import { Hono } from "hono";
import { count, desc, inArray, like, or, sql } from "drizzle-orm";
import type { AppContext } from "../core/hono-types";
import { profileAsync } from "../core/server-timing";
import { comments, feedHashtags, feeds, visitStats, visits } from "../db/schema";
import { AUTH_ERROR_CODES } from "@rin/api";
import { bizError } from "../errors";
import { clearFeedCollectionCaches } from "./clear-feed-cache";

/**
 * 管理员专属服务：全站文章统一管理（含草稿/未列出）。
 * 关键约束：每端点独立校验 admin；like 查询转义通配符；
 * 删除文章时显式清理子表（外键虽有 cascade，mock / D1 环境外键可能未强制），
 * 并按 feed.ts 的做法清掉 feeds_/search_ 前缀与文章详情缓存。
 */

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

/** 转义 LIKE 通配符，让用户输入的 % 和 _ 按字面匹配（同 admin-users.ts） */
function escapeLike(value: string): string {
  return value.replace(/[%_\\]/g, (ch) => `\\${ch}`);
}

export function AdminFeedsService(): Hono {
  const app = new Hono();

  /** 统一的管理员校验，未通过时抛 403 */
  function requireAdmin(c: AppContext) {
    if (!c.get('admin')) {
      throw bizError(AUTH_ERROR_CODES.AUTH_LOGIN_REQUIRED, 'Administrator permission required', 403);
    }
  }

  // GET /admin/feeds?page=1&size=20&keyword=xxx
  // 管理员视角返回全部文章（含草稿、未列出），不做可见性过滤
  app.get('/feeds', async (c: AppContext) => {
    requireAdmin(c);
    const db = c.get('db');

    const page = Math.max(1, Number(c.req.query('page')) || 1);
    const size = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(c.req.query('size')) || DEFAULT_PAGE_SIZE));
    const keyword = (c.req.query('keyword') || '').trim();
    const offset = (page - 1) * size;

    // 搜索命中标题或别名
    const where = keyword
      ? or(
        like(feeds.title, `%${escapeLike(keyword)}%`),
        like(feeds.alias, `%${escapeLike(keyword)}%`),
      )
      : undefined;

    const [rows, totalResult] = await profileAsync(c, 'admin_feeds_query', () =>
      Promise.all([
        db
          .select({
            id: feeds.id,
            title: feeds.title,
            alias: feeds.alias,
            summary: feeds.summary,
            draft: feeds.draft,
            listed: feeds.listed,
            top: feeds.top,
            createdAt: feeds.createdAt,
            updatedAt: feeds.updatedAt,
            // 关联统计放子查询：一次查询拿齐列表所需字段，避免 N+1。
            // 注意用全限定表名的原生 SQL：drizzle 的列引用在子查询里可能被
            // 解析到内层表上，导致 count 关联错行。
            commentCount: sql<number>`(select count(*) from comments where comments.feed_id = feeds.id)`,
            pv: sql<number>`coalesce((select pv from visit_stats where visit_stats.feed_id = feeds.id), 0)`,
          })
          .from(feeds)
          .where(where)
          .orderBy(desc(feeds.createdAt), desc(feeds.updatedAt))
          .limit(size)
          .offset(offset),
        db.select({ value: count() }).from(feeds).where(where),
      ]),
    );

    const total = totalResult[0]?.value ?? 0;

    return c.json({
      feeds: rows,
      pagination: {
        page,
        size,
        total,
        totalPages: Math.max(1, Math.ceil(total / size)),
      },
    });
  });

  // POST /admin/feeds/batch-delete — body: { ids: string[] }
  app.post('/feeds/batch-delete', async (c: AppContext) => {
    requireAdmin(c);
    const db = c.get('db');

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      throw bizError(AUTH_ERROR_CODES.AUTH_LOGIN_REQUIRED, 'Invalid payload', 400);
    }

    const ids = (body as { ids?: unknown } | null)?.ids;
    if (
      !Array.isArray(ids)
      || ids.length === 0
      || ids.some((id) => typeof id !== 'string' || id.length === 0)
    ) {
      throw bizError(AUTH_ERROR_CODES.AUTH_LOGIN_REQUIRED, 'ids must be a non-empty array of strings', 400);
    }

    const uniqueIds = [...new Set(ids as string[])];

    // 先查存在的 id：请求里可能混有已不存在的 id，删除后要如实回报 missing。
    // mock / SQLite 可能存数字而请求是文本，统一 String() 归一后再比对
    const existing = await profileAsync(c, 'admin_feeds_existing', () =>
      db.select({ id: feeds.id }).from(feeds).where(inArray(feeds.id, uniqueIds)),
    );
    const existingSet = new Set(existing.map((row) => String(row.id)));
    const existingIds = uniqueIds.filter((id) => existingSet.has(id));
    const missing = uniqueIds.filter((id) => !existingSet.has(id));

    if (existingIds.length > 0) {
      await profileAsync(c, 'admin_feeds_batch_delete', async () => {
        // comments / feed_hashtags / visit_stats / visits 对 feed_id 都配了
        // ON DELETE CASCADE，但显式先删一次：即便外键未强制（mock 或部分 D1 场景）也能清干净
        await db.delete(comments).where(inArray(comments.feedId, existingIds));
        await db.delete(feedHashtags).where(inArray(feedHashtags.feedId, existingIds));
        await db.delete(visitStats).where(inArray(visitStats.feedId, existingIds));
        await db.delete(visits).where(inArray(visits.feedId, existingIds));
        await db.delete(feeds).where(inArray(feeds.id, existingIds));
      });

      // 与 feed.ts / clear-feed-cache.ts 保持一致：清列表缓存 + 每篇文章的详情缓存
      const cache = c.get('cache');
      await profileAsync(c, 'admin_feeds_cache_invalidate', async () => {
        await clearFeedCollectionCaches(cache);
        for (const id of existingIds) {
          await cache.delete(`feed_${id}`, false);
          await cache.delete(`feed_id_${id}`, false);
          await cache.deletePrefix(`${id}_previous_feed`);
          await cache.deletePrefix(`${id}_next_feed`);
        }
        await cache.save();
      });
    }

    return c.json({ deleted: existingIds.length, missing });
  });

  return app;
}
