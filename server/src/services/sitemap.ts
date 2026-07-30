import { and, desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import type { AppContext, DB } from "../core/hono-types";
import { feeds, friends, hashtags, moments } from "../db/schema";
import { path_join } from "../utils/path";
import { getStorageObject, putStorageObjectAtKey } from "../utils/storage";

// 始终收录的静态页面
const STATIC_ROUTES = ["/", "/timeline", "/moments", "/friends", "/hashtags"];
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
  if (env.FRONTEND_URL) return env.FRONTEND_URL.replace(/\/+$/, "");
  if (requestUrl) {
    try {
      return new URL(requestUrl).origin;
    } catch {
      // 解析失败则回退到空字符串
    }
  }
  return "";
}

// 生成 sitemap.xml 内容（纯函数，供请求实时生成与 cron 预生成复用）
async function generateSitemapXml(env: Env, db: DB): Promise<string> {
  const baseUrl = getBaseUrl(env);
  const [feedRows, momentRows, friendRows, hashtagRows] = await Promise.all([
    db
      .select({ id: feeds.id, alias: feeds.alias, updatedAt: feeds.updatedAt })
      .from(feeds)
      .where(and(eq(feeds.draft, 0), eq(feeds.listed, 1))),
    db.select({ updatedAt: moments.updatedAt }).from(moments).orderBy(desc(moments.updatedAt)).limit(1),
    db.select({ updatedAt: friends.updatedAt }).from(friends).orderBy(desc(friends.updatedAt)).limit(1),
    db.select({ name: hashtags.name, updatedAt: hashtags.updatedAt }).from(hashtags),
  ]);

  const urls: string[] = [];

  const addUrl = (loc: string, lastmod?: Date | null) => {
    const lastmodStr = formatLastMod(lastmod);
    urls.push(
      `    <url>\n      <loc>${escapeXml(baseUrl + loc)}</loc>${
        lastmodStr ? `\n      <lastmod>${lastmodStr}</lastmod>` : ""
      }\n    </url>`,
    );
  };

  // 静态页面
  for (const route of STATIC_ROUTES) {
    addUrl(route);
  }

  // 文章：优先使用 alias，否则回退到 /feed/:id
  for (const feed of feedRows) {
    addUrl(feed.alias ? `/${encodeURIComponent(feed.alias)}` : `/feed/${feed.id}`, feed.updatedAt);
  }

  // 动态页面：使用最近更新时间作为 lastmod
  if (momentRows.length > 0) {
    addUrl("/moments", momentRows[0].updatedAt);
  }
  if (friendRows.length > 0) {
    addUrl("/friends", friendRows[0].updatedAt);
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
function generateRobotsTxt(env: Env): string {
  const baseUrl = getBaseUrl(env);
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
 * 与 RSS 一致，采用「请求优先读 R2/S3 缓存，未命中则实时生成并写回存储桶」的模式，
 * 同时导出 sitemapCrontab 供定时任务预生成，复用 Drizzle 与 Env/FRONTEND_URL 配置。
 */
export function SitemapService(): Hono {
  const app = new Hono();

  app.get("/sitemap.xml", async (c: AppContext) => {
    const env = c.get("env");
    const db = c.get("db");
    const key = path_join(env.S3_CACHE_FOLDER || SITEMAP_CACHE_FOLDER, "sitemap.xml");

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

    const xml = await generateSitemapXml(env, db);
    try {
      await putStorageObjectAtKey(env, key, xml, "application/xml");
    } catch (e: any) {
      console.log(`[Sitemap] cache write failed: ${e?.message}`);
    }

    return c.body(xml, 200, {
      "Content-Type": SITEMAP_CONTENT_TYPE,
      "Cache-Control": "public, max-age=600, s-maxage=3600",
    });
  });

  app.get("/robots.txt", async (c: AppContext) => {
    const env = c.get("env");
    const key = path_join(env.S3_CACHE_FOLDER || SITEMAP_CACHE_FOLDER, "robots.txt");

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

    const robots = generateRobotsTxt(env);
    try {
      await putStorageObjectAtKey(env, key, robots, "text/plain");
    } catch (e: any) {
      console.log(`[Sitemap] robots cache write failed: ${e?.message}`);
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
