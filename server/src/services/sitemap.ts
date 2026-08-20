import { and, desc, eq, or } from "drizzle-orm";
import { Hono } from "hono";
import type { AppContext, DB } from "../core/hono-types";
import { feedHashtags, feeds, friends, hashtags, moments } from "../db/schema";
import { path_join } from "../utils/path";
import { getStorageObject, putStorageObjectAtKey } from "../utils/storage";

const SITEMAP_CACHE_FOLDER = "cache/";
const SITEMAP_CONTENT_TYPE = "application/xml; charset=utf-8";
const ROBOTS_CONTENT_TYPE = "text/plain; charset=utf-8";

// XML 预定义实体转义，避免内容破坏文档结构
function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// 将 Date 或 unix 秒格式化为 W3C 日期 (YYYY-MM-DD)
function formatLastMod(value: Date | number | null | undefined): string | null {
  if (value == null) return null;
  const date = value instanceof Date ? value : new Date(value * 1000);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

// 站点根地址：优先使用显式 FRONTEND_URL，其次回退到请求来源；cron 场景无请求时留空
function getBaseUrl(env: Env, requestUrl?: string): string {
  if (env.FRONTEND_URL?.trim()) return env.FRONTEND_URL.trim().replace(/\/+$/, "");
  if (requestUrl) {
    try {
      return new URL(requestUrl).origin;
    } catch {
      // 解析失败则回退到空字符串
    }
  }
  return "";
}

function hasConfiguredBaseUrl(env: Env): boolean {
  return Boolean(env.FRONTEND_URL?.trim());
}

// 生成 sitemap.xml 内容（纯函数，供请求实时生成与 cron 预生成复用）
async function generateSitemapXml(env: Env, db: DB, requestUrl?: string): Promise<string> {
  const baseUrl = getBaseUrl(env, requestUrl);
  if (!baseUrl) {
    throw new Error("A canonical URL or request URL is required to generate a sitemap");
  }
  const [feedRows, momentRows, friendRows, hashtagRows] = await Promise.all([
    db
      .select({ id: feeds.id, alias: feeds.alias, updatedAt: feeds.updatedAt })
      .from(feeds)
      .where(and(eq(feeds.draft, 0), or(eq(feeds.listed, 1), eq(feeds.alias, "about")))),
    db.select({ updatedAt: moments.updatedAt }).from(moments).orderBy(desc(moments.updatedAt)).limit(1),
    db.select({ updatedAt: friends.updatedAt }).from(friends).orderBy(desc(friends.updatedAt)).limit(1),
    db
      .selectDistinct({ name: hashtags.name, updatedAt: hashtags.updatedAt })
      .from(hashtags)
      .innerJoin(feedHashtags, eq(feedHashtags.hashtagId, hashtags.id))
      .innerJoin(feeds, eq(feedHashtags.feedId, feeds.id))
      .where(and(eq(feeds.draft, 0), or(eq(feeds.listed, 1), eq(feeds.alias, "about")))),
  ]);

  const urls: string[] = [];

  const addUrl = (loc: string, lastmod?: Date | null) => {
    const lastmodStr = formatLastMod(lastmod);
    // 首页只输出站点根地址，不带末尾斜杠
    const fullUrl = loc === "/" ? baseUrl : baseUrl + loc;
    urls.push(
      `    <url>\n      <loc>${escapeXml(fullUrl)}</loc>${
        lastmodStr ? `\n      <lastmod>${lastmodStr}</lastmod>` : ""
      }\n    </url>`,
    );
  };

  // 取一组时间中最新的一条，作为聚合页面的 lastmod
  const latestOf = (dates: (Date | null | undefined)[]): Date | null => {
    let latest: Date | null = null;
    for (const d of dates) {
      if (d != null && (!latest || d.getTime() > latest.getTime())) latest = d;
    }
    return latest;
  };

  const latestFeedUpdatedAt = latestOf(feedRows.map((f) => f.updatedAt));
  const latestHashtagUpdatedAt = latestOf(hashtagRows.map((t) => t.updatedAt));

  // 聚合页面：各自携带对应数据源的最新更新时间
  addUrl("/", latestFeedUpdatedAt);
  addUrl("/timeline", latestFeedUpdatedAt);
  addUrl("/moments", momentRows[0]?.updatedAt);
  addUrl("/friends", friendRows[0]?.updatedAt);
  addUrl("/hashtags", latestHashtagUpdatedAt);

  // 文章：优先使用 alias，否则回退到 /feed/:id
  for (const feed of feedRows) {
    addUrl(feed.alias ? `/${encodeURIComponent(feed.alias)}` : `/feed/${feed.id}`, feed.updatedAt);
  }

  // 标签页面
  for (const tag of hashtagRows) {
    addUrl(`/hashtag/${encodeURIComponent(tag.name)}`, tag.updatedAt);
  }

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join(
    "\n",
  )}\n</urlset>\n`;
}

// 生成 robots.txt 内容
function generateRobotsTxt(env: Env, requestUrl?: string): string {
  const baseUrl = getBaseUrl(env, requestUrl);
  if (!baseUrl) {
    throw new Error("A canonical URL or request URL is required to generate robots.txt");
  }
  return `User-agent: *
Allow: /

Disallow: /admin/
Disallow: /profile/
Disallow: /login/
Disallow: /search/

Sitemap: ${baseUrl}/sitemap.xml
`;
}

/**
 * Sitemap 服务：将站点可索引 URL 暴露为 /sitemap.xml，并提供 /robots.txt。
 * 配置 FRONTEND_URL 时使用 R2/S3 预生成缓存；否则按请求 origin 实时生成，
 * 避免多域名部署将某次请求的地址写入共享缓存。
 */
export function SitemapService(): Hono {
  const app = new Hono();

  app.get("/sitemap.xml", async (c: AppContext) => {
    const env = c.get("env");
    const db = c.get("db");
    const key = path_join(env.S3_CACHE_FOLDER || SITEMAP_CACHE_FOLDER, "sitemap.xml");
    const canUsePersistentCache = hasConfiguredBaseUrl(env);

    if (canUsePersistentCache) {
      try {
        const cached = await getStorageObject(env, key);
        if (cached) {
          const text = await cached.text();
          return c.body(text, 200, {
            "Content-Type": SITEMAP_CONTENT_TYPE,
            "Cache-Control": "public, max-age=3600",
          });
        }
      } catch (e: any) {
        console.log(`[Sitemap] cache read failed: ${e?.message}, falling back to generation`);
      }
    }

    const xml = await generateSitemapXml(env, db, c.req.url);
    if (canUsePersistentCache) {
      try {
        await putStorageObjectAtKey(env, key, xml, "application/xml");
      } catch (e: any) {
        console.log(`[Sitemap] cache write failed: ${e?.message}`);
      }
    }

    return c.body(xml, 200, {
      "Content-Type": SITEMAP_CONTENT_TYPE,
      "Cache-Control": "public, max-age=600, s-maxage=3600",
    });
  });

  app.get("/robots.txt", async (c: AppContext) => {
    const env = c.get("env");
    const key = path_join(env.S3_CACHE_FOLDER || SITEMAP_CACHE_FOLDER, "robots.txt");
    const canUsePersistentCache = hasConfiguredBaseUrl(env);

    if (canUsePersistentCache) {
      try {
        const cached = await getStorageObject(env, key);
        if (cached) {
          const text = await cached.text();
          return c.body(text, 200, {
            "Content-Type": ROBOTS_CONTENT_TYPE,
            "Cache-Control": "public, max-age=3600",
          });
        }
      } catch (e: any) {
        console.log(`[Sitemap] robots cache read failed: ${e?.message}, falling back to generation`);
      }
    }

    const robots = generateRobotsTxt(env, c.req.url);
    if (canUsePersistentCache) {
      try {
        await putStorageObjectAtKey(env, key, robots, "text/plain");
      } catch (e: any) {
        console.log(`[Sitemap] robots cache write failed: ${e?.message}`);
      }
    }

    return c.body(robots, 200, {
      "Content-Type": ROBOTS_CONTENT_TYPE,
      "Cache-Control": "public, max-age=3600",
    });
  });

  return app;
}

// 定时任务：预生成 sitemap.xml 与 robots.txt 并写入存储桶（与 rssCrontab 同构）
export async function sitemapCrontab(env: Env, db: DB) {
  if (!hasConfiguredBaseUrl(env)) {
    console.log("[Sitemap] Skipping pre-generation because FRONTEND_URL is not configured");
    return;
  }

  const folder = env.S3_CACHE_FOLDER || SITEMAP_CACHE_FOLDER;

  try {
    const xml = await generateSitemapXml(env, db);
    await putStorageObjectAtKey(env, path_join(folder, "sitemap.xml"), xml, "application/xml");
    console.log("[Sitemap] Saved sitemap.xml to storage");
  } catch (e: any) {
    console.error(`[Sitemap] Failed to save sitemap.xml: ${e?.message}`);
  }

  try {
    const robots = generateRobotsTxt(env);
    await putStorageObjectAtKey(env, path_join(folder, "robots.txt"), robots, "text/plain");
    console.log("[Sitemap] Saved robots.txt to storage");
  } catch (e: any) {
    console.error(`[Sitemap] Failed to save robots.txt: ${e?.message}`);
  }
}
