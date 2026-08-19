import { describe, expect, it } from "bun:test";
import { SitemapService, sitemapCrontab } from "../sitemap";
import { cleanupTestDB, createMockEnv, setupTestApp } from "../../../tests/fixtures";

describe("SitemapService", () => {
  it("uses the request origin, bypasses shared storage, and only exposes public posts plus /about", async () => {
    let getCalls = 0;
    let putCalls = 0;
    const env = createMockEnv({
      R2_BUCKET: {
        get: async () => {
          getCalls += 1;
          return null;
        },
        put: async () => {
          putCalls += 1;
          return null;
        },
      } as unknown as R2Bucket,
    });
    const requestCtx = await setupTestApp(SitemapService, env);
    requestCtx.sqlite.exec(`INSERT INTO users (id, username, openid) VALUES (1, 'testuser', 'gh_test')`);
    requestCtx.sqlite.exec(`
      INSERT INTO feeds (id, alias, title, content, uid, draft, listed) VALUES
        (1, 'published', 'Published', 'Content', 1, 0, 1),
        (2, 'unlisted', 'Unlisted', 'Content', 1, 0, 0),
        (3, 'about', 'About', 'Content', 1, 0, 0),
        (4, 'about-draft', 'Draft About', 'Content', 1, 1, 0)
    `);
    requestCtx.sqlite.exec(`
      INSERT INTO hashtags (id, name) VALUES
        (1, 'public-tag'),
        (2, 'unlisted-tag'),
        (3, 'about-tag'),
        (4, 'draft-tag')
    `);
    requestCtx.sqlite.exec(`
      INSERT INTO feed_hashtags (feed_id, hashtag_id) VALUES
        (1, 1),
        (2, 2),
        (3, 3),
        (4, 4)
    `);

    const sitemap = await requestCtx.app.request("https://blog.example/sitemap.xml", { method: "GET" }, env);
    const xml = await sitemap.text();
    expect(xml).toContain("https://blog.example/published");
    expect(xml).toContain("https://blog.example/about");
    expect(xml).not.toContain("https://blog.example/unlisted");
    expect(xml).not.toContain("https://blog.example/about-draft");
    expect(xml).toContain("https://blog.example/hashtag/public-tag");
    expect(xml).toContain("https://blog.example/hashtag/about-tag");
    expect(xml).not.toContain("https://blog.example/hashtag/unlisted-tag");
    expect(xml).not.toContain("https://blog.example/hashtag/draft-tag");
    expect(getCalls).toBe(0);
    expect(putCalls).toBe(0);

    const robots = await requestCtx.app.request("https://blog.example/robots.txt", { method: "GET" }, env);
    expect(await robots.text()).toContain("Sitemap: https://blog.example/sitemap.xml");
    expect(getCalls).toBe(0);
    expect(putCalls).toBe(0);

    cleanupTestDB(requestCtx.sqlite);
  });

  it("uses FRONTEND_URL for canonical URLs and persistent storage", async () => {
    const keys: string[] = [];
    const env = createMockEnv({
      FRONTEND_URL: "https://canonical.example/",
      R2_BUCKET: {
        get: async () => null,
        put: async (key: string) => {
          keys.push(key);
          return null;
        },
      } as unknown as R2Bucket,
    });
    const ctx = await setupTestApp(SitemapService, env);
    ctx.sqlite.exec(`INSERT INTO users (id, username, openid) VALUES (1, 'testuser', 'gh_test')`);
    ctx.sqlite.exec(`INSERT INTO feeds (id, title, content, uid, draft, listed) VALUES (1, 'Published', 'Content', 1, 0, 1)`);

    const sitemap = await ctx.app.request("https://other.example/sitemap.xml", { method: "GET" }, env);
    expect(await sitemap.text()).toContain("https://canonical.example/feed/1");
    const robots = await ctx.app.request("https://other.example/robots.txt", { method: "GET" }, env);
    expect(await robots.text()).toContain("Sitemap: https://canonical.example/sitemap.xml");
    expect(keys).toEqual(["cache/sitemap.xml", "cache/robots.txt"]);

    cleanupTestDB(ctx.sqlite);
  });
});

describe("sitemapCrontab", () => {
  it("does not write sitemap or robots caches without FRONTEND_URL", async () => {
    let putCalls = 0;
    const env = createMockEnv({
      R2_BUCKET: {
        put: async () => {
          putCalls += 1;
          return null;
        },
      } as unknown as R2Bucket,
    });
    const ctx = await setupTestApp(SitemapService, env);

    await sitemapCrontab(env, ctx.db);

    expect(putCalls).toBe(0);
    cleanupTestDB(ctx.sqlite);
  });

  it("writes sitemap and robots caches when FRONTEND_URL is configured", async () => {
    const keys: string[] = [];
    const env = createMockEnv({
      FRONTEND_URL: "https://canonical.example",
      R2_BUCKET: {
        put: async (key: string) => {
          keys.push(key);
          return null;
        },
      } as unknown as R2Bucket,
    });
    const ctx = await setupTestApp(SitemapService, env);

    await sitemapCrontab(env, ctx.db);

    expect(keys).toEqual(["cache/sitemap.xml", "cache/robots.txt"]);
    cleanupTestDB(ctx.sqlite);
  });
});
