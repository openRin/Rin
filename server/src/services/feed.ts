import { and, asc, count, desc, eq, gt, like, lt, or } from "drizzle-orm";
import { Hono } from "hono";
import { startTime, endTime } from "hono/timing";
import type { Variables, CacheImpl } from "../core/hono-types";
import { feeds, visits, visitStats } from "../db/schema";
import { HyperLogLog } from "../utils/hyperloglog";
import { generateAISummary } from "../utils/ai";
import { extractImage } from "../utils/image";
import { bindTagToPost } from "./tag";

// Lazy-loaded modules for WordPress import
let XMLParser: any;
let html2md: any;

async function initWPModules() {
    if (!XMLParser) {
        const fxp = await import("fast-xml-parser");
        XMLParser = fxp.XMLParser;
    }
    if (!html2md) {
        const h2m = await import("html-to-md");
        html2md = h2m.default;
    }
}

export function FeedService(): Hono<{
    Bindings: Env;
    Variables: Variables;
}> {
    const app = new Hono<{
        Bindings: Env;
        Variables: Variables;
    }>();

    // GET /feed - List feeds
    app.get('/', async (c) => {
        startTime(c, 'feed-list');
        const db = c.get('db');
        const cache = c.get('cache');
        const admin = c.get('admin');
        const page = c.req.query('page');
        const limit = c.req.query('limit');
        const type = c.req.query('type');

        if ((type === 'draft' || type === 'unlisted') && !admin) {
            return c.text('Permission denied', 403);
        }

        const page_num = (page ? parseInt(page) > 0 ? parseInt(page) : 1 : 1) - 1;
        const limit_num = limit ? parseInt(limit) > 50 ? 50 : parseInt(limit) : 20;
        const cacheKey = `feeds_${type}_${page_num}_${limit_num}`;
        
        startTime(c, 'cache-get');
        const cached = await cache.get(cacheKey);
        endTime(c, 'cache-get');

        if (cached) {
            endTime(c, 'feed-list');
            return c.json(cached);
        }

        const where = type === 'draft'
            ? eq(feeds.draft, 1)
            : type === 'unlisted'
                ? and(eq(feeds.draft, 0), eq(feeds.listed, 0))
                : and(eq(feeds.draft, 0), eq(feeds.listed, 1));

        startTime(c, 'db-count');
        const size = await db.select({ count: count() }).from(feeds).where(where);
        endTime(c, 'db-count');

        if (size[0].count === 0) {
            endTime(c, 'feed-list');
            return c.json({ size: 0, data: [], hasNext: false });
        }

        startTime(c, 'db-query');
        const feed_list = (await db.query.feeds.findMany({
            where: where,
            columns: admin ? undefined : { draft: false, listed: false },
            with: {
                hashtags: {
                    columns: {},
                    with: {
                        hashtag: { columns: { id: true, name: true } }
                    }
                },
                user: { columns: { id: true, username: true, avatar: true } }
            },
            orderBy: [desc(feeds.top), desc(feeds.createdAt), desc(feeds.updatedAt)],
            offset: page_num * limit_num,
            limit: limit_num + 1,
        })).map(({ content, hashtags, summary, ...other }: any) => {
            const avatar = extractImage(content);
            return {
                summary: summary.length > 0 ? summary : content.length > 100 ? content.slice(0, 100) : content,
                hashtags: hashtags.map(({ hashtag }: any) => hashtag),
                avatar,
                ...other
            };
        });
        endTime(c, 'db-query');

        let hasNext = false;
        if (feed_list.length === limit_num + 1) {
            feed_list.pop();
            hasNext = true;
        }

        const data = { size: size[0].count, data: feed_list, hasNext };

        if (type === undefined || type === 'normal' || type === '') {
            startTime(c, 'cache-set');
            await cache.set(cacheKey, data);
            endTime(c, 'cache-set');
        }

        endTime(c, 'feed-list');
        return c.json(data);
    });

    // GET /feed/timeline
    app.get('/timeline', async (c) => {
        startTime(c, 'feed-timeline');
        const db = c.get('db');
        const where = and(eq(feeds.draft, 0), eq(feeds.listed, 1));

        startTime(c, 'db-query');
        const result = await db.query.feeds.findMany({
            where: where,
            columns: { id: true, title: true, createdAt: true },
            orderBy: [desc(feeds.createdAt), desc(feeds.updatedAt)],
        });
        endTime(c, 'db-query');
        endTime(c, 'feed-timeline');
        return c.json(result);
    });

    // POST /feed - Create feed
    app.post('/', async (c) => {
        startTime(c, 'feed-create');
        const db = c.get('db');
        const cache = c.get('cache');
        const env = c.get('env');
        const admin = c.get('admin');
        const uid = c.get('uid');
        const body = await c.req.json();
        const { title, alias, listed, content, summary, draft, tags, createdAt } = body;

        if (!admin) {
            return c.text('Permission denied', 403);
        }

        if (!title) {
            return c.text('Title is required', 400);
        }
        if (!content) {
            return c.text('Content is required', 400);
        }

        startTime(c, 'db-check-exist');
        const exist = await db.query.feeds.findFirst({
            where: or(eq(feeds.title, title), eq(feeds.content, content))
        });
        endTime(c, 'db-check-exist');

        if (exist) {
            return c.text('Content already exists', 400);
        }

        const date = createdAt ? new Date(createdAt) : new Date();

        if (!uid) {
            return c.text('User ID is required', 400);
        }

        // Generate AI summary if enabled and not a draft
        let ai_summary = "";
        if (!draft) {
            startTime(c, 'ai-summary');
            const generatedSummary = await generateAISummary(env, db, content);
            if (generatedSummary) {
                ai_summary = generatedSummary;
            }
            endTime(c, 'ai-summary');
        }

        startTime(c, 'db-insert');
        const result = await db.insert(feeds).values({
            title,
            content,
            summary,
            ai_summary,
            uid,
            alias,
            listed: listed ? 1 : 0,
            draft: draft ? 1 : 0,
            createdAt: date,
            updatedAt: date
        }).returning({ insertedId: feeds.id });
        endTime(c, 'db-insert');

        startTime(c, 'bind-tags');
        await bindTagToPost(db, result[0].insertedId, tags);
        endTime(c, 'bind-tags');
        
        startTime(c, 'cache-clear');
        await cache.deletePrefix('feeds_');
        endTime(c, 'cache-clear');
        
        endTime(c, 'feed-create');

        if (result.length === 0) {
            return c.text('Failed to insert', 500);
        } else {
            return c.json(result[0]);
        }
    });

    // GET /feed/:id
    app.get('/:id', async (c) => {
        startTime(c, 'feed-get');
        const db = c.get('db');
        const cache = c.get('cache');
        const clientConfig = c.get('clientConfig');
        const admin = c.get('admin');
        const uid = c.get('uid');
        const id = c.req.param('id');
        const id_num = parseInt(id);
        const cacheKey = `feed_${id}`;

        startTime(c, 'cache-getOrSet');
        const feed = await cache.getOrSet(cacheKey, () => db.query.feeds.findFirst({
            where: or(eq(feeds.id, id_num), eq(feeds.alias, id)),
            with: {
                hashtags: {
                    columns: {},
                    with: {
                        hashtag: { columns: { id: true, name: true } }
                    }
                },
                user: { columns: { id: true, username: true, avatar: true } }
            }
        }));
        endTime(c, 'cache-getOrSet');

        if (!feed) {
            endTime(c, 'feed-get');
            return c.text('Not found', 404);
        }

        if (feed.draft && feed.uid !== uid && !admin) {
            endTime(c, 'feed-get');
            return c.text('Permission denied', 403);
        }

        const { hashtags, ...other } = feed;
        const hashtags_flatten = hashtags.map((f: any) => f.hashtag);

        // update visits using HyperLogLog for efficient UV estimation
        startTime(c, 'config-get');
        const enableVisit = await clientConfig.getOrDefault('counter.enabled', true);
        endTime(c, 'config-get');
        let pv = 0;
        let uv = 0;

        if (enableVisit) {
            const ip = c.req.header('cf-connecting-ip') || c.req.header('x-real-ip') || "UNK";
            const visitorKey = `${ip}`;

            // Get or create visit stats for this feed
            startTime(c, 'db-visit-stats-query');
            let stats = await db.query.visitStats.findFirst({
                where: eq(visitStats.feedId, feed.id)
            });
            endTime(c, 'db-visit-stats-query');

            if (!stats) {
                // Create new stats record
                startTime(c, 'db-visit-stats-insert');
                await db.insert(visitStats).values({
                    feedId: feed.id,
                    pv: 1,
                    hllData: new HyperLogLog().serialize()
                });
                endTime(c, 'db-visit-stats-insert');
                pv = 1;
                uv = 1;
            } else {
                // Update existing stats
                const hll = new HyperLogLog(stats.hllData);
                hll.add(visitorKey);
                const newHllData = hll.serialize();
                const newPv = stats.pv + 1;

                startTime(c, 'db-visit-stats-update');
                await db.update(visitStats)
                    .set({
                        pv: newPv,
                        hllData: newHllData,
                        updatedAt: new Date()
                    })
                    .where(eq(visitStats.feedId, feed.id));
                endTime(c, 'db-visit-stats-update');

                pv = newPv;
                uv = Math.round(hll.count());
            }

            // Keep recording to visits table for backup/history
            startTime(c, 'db-visits-insert');
            await db.insert(visits).values({ feedId: feed.id, ip: ip });
            endTime(c, 'db-visits-insert');
        }

        endTime(c, 'feed-get');
        return c.json({ ...other, hashtags: hashtags_flatten, pv, uv });
    });

    // GET /feed/adjacent/:id
    app.get("/adjacent/:id", async (c) => {
        startTime(c, 'feed-adjacent');
        const db = c.get('db');
        const cache = c.get('cache');
        const id = c.req.param('id');
        let id_num: number;

        if (isNaN(parseInt(id))) {
            startTime(c, 'db-alias-query');
            const aliasRecord = await db.select({ id: feeds.id }).from(feeds).where(eq(feeds.alias, id));
            endTime(c, 'db-alias-query');
            if (aliasRecord.length === 0) {
                endTime(c, 'feed-adjacent');
                return c.text("Not found", 404);
            }
            id_num = aliasRecord[0].id;
        } else {
            id_num = parseInt(id);
        }

        startTime(c, 'db-feed-query');
        const feed = await db.query.feeds.findFirst({
            where: eq(feeds.id, id_num),
            columns: { createdAt: true },
        });
        endTime(c, 'db-feed-query');

        if (!feed) {
            endTime(c, 'feed-adjacent');
            return c.text("Not found", 404);
        }

        const created_at = feed.createdAt;

        function formatAndCacheData(feed: any, feedDirection: "previous_feed" | "next_feed") {
            if (feed) {
                const hashtags_flatten = feed.hashtags.map((f: any) => f.hashtag);
                const summary = feed.summary.length > 0
                    ? feed.summary
                    : feed.content.length > 50
                        ? feed.content.slice(0, 50)
                        : feed.content;
                const cacheKey = `${feed.id}_${feedDirection}_${id_num}`;
                const cacheData = {
                    id: feed.id,
                    title: feed.title,
                    summary: summary,
                    hashtags: hashtags_flatten,
                    createdAt: feed.createdAt,
                    updatedAt: feed.updatedAt,
                };
                startTime(c, `cache-set-${feedDirection}`);
                cache.set(cacheKey, cacheData);
                endTime(c, `cache-set-${feedDirection}`);
                return cacheData;
            }
            return null;
        }

        const getPreviousFeed = async () => {
            startTime(c, 'cache-get-previous');
            const previousFeedCached = await cache.getBySuffix(`previous_feed_${id_num}`);
            endTime(c, 'cache-get-previous');
            if (previousFeedCached && previousFeedCached.length > 0) {
                return previousFeedCached[0];
            } else {
                startTime(c, 'db-query-previous');
                const tempPreviousFeed = await db.query.feeds.findFirst({
                    where: and(and(eq(feeds.draft, 0), eq(feeds.listed, 1)), lt(feeds.createdAt, created_at)),
                    orderBy: [desc(feeds.createdAt)],
                    with: {
                        hashtags: {
                            columns: {},
                            with: { hashtag: { columns: { id: true, name: true } } }
                        },
                        user: { columns: { id: true, username: true, avatar: true } }
                    },
                });
                endTime(c, 'db-query-previous');
                return formatAndCacheData(tempPreviousFeed, "previous_feed");
            }
        };

        const getNextFeed = async () => {
            startTime(c, 'cache-get-next');
            const nextFeedCached = await cache.getBySuffix(`next_feed_${id_num}`);
            endTime(c, 'cache-get-next');
            if (nextFeedCached && nextFeedCached.length > 0) {
                return nextFeedCached[0];
            } else {
                startTime(c, 'db-query-next');
                const tempNextFeed = await db.query.feeds.findFirst({
                    where: and(and(eq(feeds.draft, 0), eq(feeds.listed, 1)), gt(feeds.createdAt, created_at)),
                    orderBy: [asc(feeds.createdAt)],
                    with: {
                        hashtags: {
                            columns: {},
                            with: { hashtag: { columns: { id: true, name: true } } }
                        },
                        user: { columns: { id: true, username: true, avatar: true } }
                    },
                });
                endTime(c, 'db-query-next');
                return formatAndCacheData(tempNextFeed, "next_feed");
            }
        };

        const [previousFeed, nextFeed] = await Promise.all([getPreviousFeed(), getNextFeed()]);
        endTime(c, 'feed-adjacent');
        return c.json({ previousFeed, nextFeed });
    });

    // POST /feed/:id - Update feed
    app.post('/:id', async (c) => {
        startTime(c, 'feed-update');
        const db = c.get('db');
        const cache = c.get('cache');
        const env = c.get('env');
        const admin = c.get('admin');
        const uid = c.get('uid');
        const id = c.req.param('id');
        const body = await c.req.json();
        const { title, listed, content, summary, alias, draft, top, tags, createdAt } = body;

        const id_num = parseInt(id);
        startTime(c, 'db-feed-query');
        const feed = await db.query.feeds.findFirst({ where: eq(feeds.id, id_num) });
        endTime(c, 'db-feed-query');

        if (!feed) {
            endTime(c, 'feed-update');
            return c.text('Not found', 404);
        }

        if (feed.uid !== uid && !admin) {
            endTime(c, 'feed-update');
            return c.text('Permission denied', 403);
        }

        // Generate AI summary if content changed and not a draft
        let ai_summary: string | undefined = undefined;
        const contentChanged = content && content !== feed.content;
        const isDraft = draft !== undefined ? draft : (feed.draft === 1);

        if (contentChanged && !isDraft) {
            startTime(c, 'ai-summary');
            const generatedSummary = await generateAISummary(env, db, content);
            if (generatedSummary) {
                ai_summary = generatedSummary;
            }
            endTime(c, 'ai-summary');
        }

        if (!isDraft && feed.draft === 1 && !feed.ai_summary) {
            startTime(c, 'ai-summary-draft');
            const contentToSummarize = content || feed.content;
            const generatedSummary = await generateAISummary(env, db, contentToSummarize);
            if (generatedSummary) {
                ai_summary = generatedSummary;
            }
            endTime(c, 'ai-summary-draft');
        }

        startTime(c, 'db-update');
        await db.update(feeds).set({
            title,
            content,
            summary,
            ai_summary,
            alias,
            top,
            listed: listed ? 1 : 0,
            draft: draft ? 1 : 0,
            createdAt: createdAt ? new Date(createdAt) : undefined,
            updatedAt: new Date()
        }).where(eq(feeds.id, id_num));
        endTime(c, 'db-update');

        if (tags) {
            startTime(c, 'bind-tags');
            await bindTagToPost(db, id_num, tags);
            endTime(c, 'bind-tags');
        }

        startTime(c, 'cache-clear');
        await clearFeedCache(cache, id_num, feed.alias, alias || null);
        endTime(c, 'cache-clear');
        endTime(c, 'feed-update');
        return c.text('Updated');
    });

    // POST /feed/top/:id
    app.post('/top/:id', async (c) => {
        startTime(c, 'feed-top');
        const db = c.get('db');
        const cache = c.get('cache');
        const admin = c.get('admin');
        const uid = c.get('uid');
        const id = c.req.param('id');
        const body = await c.req.json();
        const { top } = body;

        const id_num = parseInt(id);
        startTime(c, 'db-feed-query');
        const feed = await db.query.feeds.findFirst({ where: eq(feeds.id, id_num) });
        endTime(c, 'db-feed-query');

        if (!feed) {
            endTime(c, 'feed-top');
            return c.text('Not found', 404);
        }

        if (feed.uid !== uid && !admin) {
            endTime(c, 'feed-top');
            return c.text('Permission denied', 403);
        }

        startTime(c, 'db-update');
        await db.update(feeds).set({ top }).where(eq(feeds.id, feed.id));
        endTime(c, 'db-update');
        startTime(c, 'cache-clear');
        await clearFeedCache(cache, feed.id, null, null);
        endTime(c, 'cache-clear');
        endTime(c, 'feed-top');
        return c.text('Updated');
    });

    // DELETE /feed/:id
    app.delete('/:id', async (c) => {
        startTime(c, 'feed-delete');
        const db = c.get('db');
        const cache = c.get('cache');
        const admin = c.get('admin');
        const uid = c.get('uid');
        const id = c.req.param('id');

        const id_num = parseInt(id);
        startTime(c, 'db-feed-query');
        const feed = await db.query.feeds.findFirst({ where: eq(feeds.id, id_num) });
        endTime(c, 'db-feed-query');

        if (!feed) {
            endTime(c, 'feed-delete');
            return c.text('Not found', 404);
        }

        if (feed.uid !== uid && !admin) {
            endTime(c, 'feed-delete');
            return c.text('Permission denied', 403);
        }

        startTime(c, 'db-delete');
        await db.delete(feeds).where(eq(feeds.id, id_num));
        endTime(c, 'db-delete');
        startTime(c, 'cache-clear');
        await clearFeedCache(cache, id_num, feed.alias, null);
        endTime(c, 'cache-clear');
        endTime(c, 'feed-delete');
        return c.text('Deleted');
    });
    return app;
}

export function SearchService(): Hono<{
    Bindings: Env;
    Variables: Variables;
}> {
    const app = new Hono<{
        Bindings: Env;
        Variables: Variables;
    }>();

    // GET /search/:keyword
    app.get('/:keyword', async (c) => {
        startTime(c, 'search');
        const db = c.get('db');
        const cache = c.get('cache');
        const admin = c.get('admin');
        const page = c.req.query('page');
        const limit = c.req.query('limit');
        let keyword = c.req.param('keyword');

        keyword = decodeURI(keyword);
        const page_num = (page ? parseInt(page) > 0 ? parseInt(page) : 1 : 1) - 1;
        const limit_num = limit ? parseInt(limit) > 50 ? 50 : parseInt(limit) : 20;

        if (keyword === undefined || keyword.trim().length === 0) {
            endTime(c, 'search');
            return c.json({ size: 0, data: [], hasNext: false });
        }

        const cacheKey = `search_${keyword}`;
        const searchKeyword = `%${keyword}%`;
        const whereClause = or(
            like(feeds.title, searchKeyword),
            like(feeds.content, searchKeyword),
            like(feeds.summary, searchKeyword),
            like(feeds.alias, searchKeyword)
        );

        startTime(c, 'cache-getOrSet');
        const feed_list = (await cache.getOrSet(cacheKey, () => db.query.feeds.findMany({
            where: admin ? whereClause : and(whereClause, eq(feeds.draft, 0)),
            columns: admin ? undefined : { draft: false, listed: false },
            with: {
                hashtags: {
                    columns: {},
                    with: { hashtag: { columns: { id: true, name: true } } }
                },
                user: { columns: { id: true, username: true, avatar: true } }
            },
            orderBy: [desc(feeds.createdAt), desc(feeds.updatedAt)],
        }))).map(({ content, hashtags, summary, ...other }: any) => {
            return {
                summary: summary.length > 0 ? summary : content.length > 100 ? content.slice(0, 100) : content,
                hashtags: hashtags.map(({ hashtag }: any) => hashtag),
                ...other
            };
        });
        endTime(c, 'cache-getOrSet');

        if (feed_list.length <= page_num * limit_num) {
            endTime(c, 'search');
            return c.json({ size: feed_list.length, data: [], hasNext: false });
        } else if (feed_list.length <= page_num * limit_num + limit_num) {
            endTime(c, 'search');
            return c.json({ size: feed_list.length, data: feed_list.slice(page_num * limit_num), hasNext: false });
        } else {
            endTime(c, 'search');
            return c.json({
                size: feed_list.length,
                data: feed_list.slice(page_num * limit_num, page_num * limit_num + limit_num),
                hasNext: true
            });
        }
    });
    return app;
}


export function WordPressService(): Hono<{
    Bindings: Env;
    Variables: Variables;
}> {
    const app = new Hono<{
        Bindings: Env;
        Variables: Variables;
    }>();

    // POST /wp - WordPress import
    app.post('/', async (c) => {
        startTime(c, 'wp-import');
        const db = c.get('db');
        const cache = c.get('cache');
        const admin = c.get('admin');
        const body = await c.req.parseBody();
        const data = body.data as File;

        if (!admin) {
            endTime(c, 'wp-import');
            return c.text('Permission denied', 403);
        }

        if (!data) {
            endTime(c, 'wp-import');
            return c.text('Data is required', 400);
        }

        // Initialize WordPress import modules lazily
        startTime(c, 'init-wp-modules');
        await initWPModules();
        endTime(c, 'init-wp-modules');

        const xml = await data.text();
        startTime(c, 'xml-parse');
        const parser = new XMLParser();
        const result = await parser.parse(xml);
        endTime(c, 'xml-parse');
        const items = result.rss.channel.item;

        if (!items) {
            endTime(c, 'wp-import');
            return c.text('No items found', 404);
        }

        startTime(c, 'process-items');
        const feedItems: FeedItem[] = items?.map((item: any) => {
            const createdAt = new Date(item?.['wp:post_date']);
            const updatedAt = new Date(item?.['wp:post_modified']);
            const draft = item?.['wp:status'] !== 'publish';
            const contentHtml = item?.['content:encoded'];
            const content = html2md(contentHtml);
            const summary = content.length > 100 ? content.slice(0, 100) : content;
            let tags = item?.['category'];

            if (tags && Array.isArray(tags)) {
                tags = tags.map((tag: any) => tag + '');
            } else if (tags && typeof tags === 'string') {
                tags = [tags];
            }

            return {
                title: item.title,
                summary,
                content,
                draft,
                createdAt,
                updatedAt,
                tags
            };
        });
        endTime(c, 'process-items');

        let success = 0;
        let skipped = 0;
        let skippedList: { title: string, reason: string }[] = [];

        for (const item of feedItems) {
            if (!item.content) {
                skippedList.push({ title: item.title, reason: "no content" });
                skipped++;
                continue;
            }

            startTime(c, `db-check-exist-${success + skipped}`);
            const exist = await db.query.feeds.findFirst({ where: eq(feeds.content, item.content) });
            endTime(c, `db-check-exist-${success + skipped}`);
            if (exist) {
                skippedList.push({ title: item.title, reason: "content exists" });
                skipped++;
                continue;
            }

            startTime(c, `db-insert-${success + skipped}`);
            const result = await db.insert(feeds).values({
                title: item.title,
                content: item.content,
                summary: item.summary,
                uid: 1,
                listed: 1,
                draft: item.draft ? 1 : 0,
                createdAt: item.createdAt,
                updatedAt: item.updatedAt
            }).returning({ insertedId: feeds.id });
            endTime(c, `db-insert-${success + skipped}`);

            if (item.tags) {
                startTime(c, `bind-tags-${success}`);
                await bindTagToPost(db, result[0].insertedId, item.tags);
                endTime(c, `bind-tags-${success}`);
            }
            success++;
        }

        startTime(c, 'cache-clear');
        cache.deletePrefix('feeds_');
        endTime(c, 'cache-clear');
        endTime(c, 'wp-import');
        return c.json({ success, skipped, skippedList });
    });
    return app;
}

type FeedItem = {
    title: string;
    summary: string;
    content: string;
    draft: boolean;
    createdAt: Date;
    updatedAt: Date;
    tags?: string[];
}

async function clearFeedCache(cache: CacheImpl, id: number, alias: string | null, newAlias: string | null) {
    await cache.deletePrefix('feeds_');
    await cache.deletePrefix('search_');
    await cache.delete(`feed_${id}`, false);
    await cache.deletePrefix(`${id}_previous_feed`);
    await cache.deletePrefix(`${id}_next_feed`);
    if (alias === newAlias) return;
    if (alias) await cache.delete(`feed_${alias}`, false);
    if (newAlias) await cache.delete(`feed_${newAlias}`, false);
}
