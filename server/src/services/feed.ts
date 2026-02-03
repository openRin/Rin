import { and, asc, count, desc, eq, gt, like, lt, or } from "drizzle-orm";
import { t } from "elysia";
import { XMLParser } from "fast-xml-parser";
import html2md from 'html-to-md';
import { feeds, visits } from "../db/schema";
import base from "../base";
import { generateAISummary } from "../utils/ai";
import { CacheImpl } from "../utils/cache";
import { extractImage } from "../utils/image";
import { bindTagToPost } from "./tag";


export const FeedService = base()
    .group('/feed', (group) =>
        group
            .get('/', async ({ admin, set, query: { page, limit, type }, store: { db, cache } }) => {
                if ((type === 'draft' || type === 'unlisted') && !admin) {
                    set.status = 403;
                    return 'Permission denied';
                }
                const page_num = (page ? page > 0 ? page : 1 : 1) - 1;
                const limit_num = limit ? +limit > 50 ? 50 : +limit : 20;
                const cacheKey = `feeds_${type}_${page_num}_${limit_num}`;
                const cached = await cache.get(cacheKey);
                if (cached) {
                    return cached;
                }
                const where = type === 'draft' ? eq(feeds.draft, 1) : type === 'unlisted' ? and(eq(feeds.draft, 0), eq(feeds.listed, 0)) : and(eq(feeds.draft, 0), eq(feeds.listed, 1));
                const size = await db.select({ count: count() }).from(feeds).where(where);
                if (size[0].count === 0) {
                    return {
                        size: 0,
                        data: [],
                        hasNext: false
                    }
                }
                const feed_list = (await db.query.feeds.findMany({
                    where: where,
                    columns: admin ? undefined : {
                        draft: false,
                        listed: false
                    },
                    with: {
                        hashtags: {
                            columns: {},
                            with: {
                                hashtag: {
                                    columns: { id: true, name: true }
                                }
                            }
                        }, user: {
                            columns: { id: true, username: true, avatar: true }
                        }
                    },
                    orderBy: [desc(feeds.top), desc(feeds.createdAt), desc(feeds.updatedAt)],
                    offset: page_num * limit_num,
                    limit: limit_num + 1,
                })).map(({ content, hashtags, summary, ...other }) => {
                    // 提取首图
                    const avatar = extractImage(content);
                    return {
                        summary: summary.length > 0 ? summary : content.length > 100 ? content.slice(0, 100) : content,
                        hashtags: hashtags.map(({ hashtag }: { hashtag: any }) => hashtag),
                        avatar,
                        ...other
                    }
                });
                let hasNext = false
                if (feed_list.length === limit_num + 1) {
                    feed_list.pop();
                    hasNext = true;
                }
                const data = {
                    size: size[0].count,
                    data: feed_list,
                    hasNext
                }
                if (type === undefined || type === 'normal' || type === '')
                    await cache.set(cacheKey, data);
                return data
            }, {
                query: t.Object({
                    page: t.Optional(t.Numeric()),
                    limit: t.Optional(t.Numeric()),
                    type: t.Optional(t.String())
                })
            })
            .get('/timeline', async ({ store: { db } }) => {
                const where = and(eq(feeds.draft, 0), eq(feeds.listed, 1));
                return (await db.query.feeds.findMany({
                    where: where,
                    columns: {
                        id: true,
                        title: true,
                        createdAt: true,
                    },
                    orderBy: [desc(feeds.createdAt), desc(feeds.updatedAt)],
                }))
            })
            .post('/', async ({ admin, set, uid, body: { title, alias, listed, content, summary, draft, tags, createdAt }, store: { db, cache } }) => {
                if (!admin) {
                    set.status = 403;
                    return 'Permission denied';
                }
                // input check
                if (!title) {
                    set.status = 400;
                    return 'Title is required';
                }
                if (!content) {
                    set.status = 400;
                    return 'Content is required';
                }

                // check exist
                const exist = await db.query.feeds.findFirst({
                    where: or(eq(feeds.title, title), eq(feeds.content, content))
                });
                if (exist) {
                    set.status = 400;
                    return 'Content already exists';
                }
                const date = createdAt ? new Date(createdAt) : new Date();

                // Generate AI summary if enabled and not a draft
                let ai_summary = "";
                if (!draft) {
                    const generatedSummary = await generateAISummary(db, content);
                    if (generatedSummary) {
                        ai_summary = generatedSummary;
                    }
                }

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
                await bindTagToPost(db, result[0].insertedId, tags);
                await cache.deletePrefix('feeds_');
                if (result.length === 0) {
                    set.status = 500;
                    return 'Failed to insert';
                } else {
                    return result[0];
                }
            }, {
                body: t.Object({
                    title: t.String(),
                    content: t.String(),
                    summary: t.String(),
                    alias: t.Optional(t.String()),
                    draft: t.Boolean(),
                    listed: t.Boolean(),
                    createdAt: t.Optional(t.Date()),
                    tags: t.Array(t.String())
                })
            })
            .get('/:id', async ({ uid, admin, set, headers, params: { id }, store: { db, cache, clientConfig } }) => {
                const id_num = parseInt(id);
                const cacheKey = `feed_${id}`;
                const feed = await cache.getOrSet(cacheKey, () => (db.query.feeds.findFirst({
                    where: or(eq(feeds.id, id_num), eq(feeds.alias, id)),
                    with: {
                        hashtags: {
                            columns: {},
                            with: {
                                hashtag: {
                                    columns: { id: true, name: true }
                                }
                            }
                        }, user: {
                            columns: { id: true, username: true, avatar: true }
                        }
                    }
                })));
                if (!feed) {
                    set.status = 404;
                    return 'Not found';
                }
                // permission check
                if (feed.draft && feed.uid !== uid && !admin) {
                    set.status = 403;
                    return 'Permission denied';
                }

                const { hashtags, ...other } = feed;
                const hashtags_flatten = hashtags.map((f: any) => f.hashtag);


                // update visits
                const enableVisit = await clientConfig.getOrDefault('counter.enabled', true);
                let pv = 0;
                let uv = 0;
                if (enableVisit) {
                    const ip = headers['cf-connecting-ip'] || headers['x-real-ip'] || "UNK"
                    await db.insert(visits).values({
                        feedId: feed.id,
                        ip: ip,
                    });
                    const visit = await db.query.visits.findMany({
                        where: eq(visits.feedId, feed.id),
                        columns: { id: true, ip: true }
                    });
                    pv = visit.length;
                    uv = new Set(visit.map((v: any) => v.ip)).size;
                }
                const data = {
                    ...other,
                    hashtags: hashtags_flatten,
                    pv,
                    uv
                };
                return data;
            })
            .get("/adjacent/:id", async ({ set, params: { id }, store: { db, cache } }) => {
                let id_num: number;
                if (isNaN(parseInt(id))) {
                    const aliasRecord = await db
                        .select({ id: feeds.id })
                        .from(feeds)
                        .where(eq(feeds.alias, id));
                    if (aliasRecord.length === 0) {
                        set.status = 404;
                        return "Not found";
                    }
                    id_num = aliasRecord[0].id;
                } else {
                    id_num = parseInt(id);
                }

                const feed = await db.query.feeds.findFirst({
                    where: eq(feeds.id, id_num),
                    columns: { createdAt: true },
                });
                if (!feed) {
                    set.status = 404;
                    return "Not found";
                }
                const created_at = feed.createdAt;

                function formatAndCacheData(
                    feed: any,
                    feedDirection: "previous_feed" | "next_feed",
                ) {
                    if (feed) {
                        const hashtags_flatten = feed.hashtags.map((f: any) => f.hashtag);
                        const summary =
                            feed.summary.length > 0
                                ? feed.summary
                                : feed.content.length > 50
                                    ? feed.content.slice(0, 50)
                                    : feed.content;
                        // NOTE: feed.id is adjacent feed, id_num is current feed id
                        const cacheKey = `${feed.id}_${feedDirection}_${id_num}`;
                        const cacheData = {
                            id: feed.id,
                            title: feed.title,
                            summary: summary,
                            hashtags: hashtags_flatten,
                            createdAt: feed.createdAt,
                            updatedAt: feed.updatedAt,
                        };
                        cache.set(cacheKey, cacheData);
                        return cacheData;
                    }
                    return null;
                }
                const getPreviousFeed = async () => {
                    // It should return an array with only one data item
                    const previousFeedCached = await cache.getBySuffix(
                        `previous_feed_${id_num}`,
                    );
                    if (previousFeedCached && previousFeedCached.length > 0) {
                        return previousFeedCached[0];
                    } else {
                        const tempPreviousFeed = await db.query.feeds.findFirst({
                            where: and(
                                and(eq(feeds.draft, 0), eq(feeds.listed, 1)),
                                lt(feeds.createdAt, created_at),
                            ),
                            orderBy: [desc(feeds.createdAt)],
                            with: {
                                hashtags: {
                                    columns: {},
                                    with: {
                                        hashtag: {
                                            columns: { id: true, name: true },
                                        },
                                    },
                                },
                                user: {
                                    columns: { id: true, username: true, avatar: true },
                                },
                            },
                        });
                        return formatAndCacheData(tempPreviousFeed, "previous_feed");
                    }
                };
                const getNextFeed = async () => {
                    const nextFeedCached = await cache.getBySuffix(
                        `next_feed_${id_num}`,
                    );
                    if (nextFeedCached && nextFeedCached.length > 0) {
                        return nextFeedCached[0];
                    } else {
                        const tempNextFeed = await db.query.feeds.findFirst({
                            where: and(
                                and(eq(feeds.draft, 0), eq(feeds.listed, 1)),
                                gt(feeds.createdAt, created_at),
                            ),
                            orderBy: [asc(feeds.createdAt)],
                            with: {
                                hashtags: {
                                    columns: {},
                                    with: {
                                        hashtag: {
                                            columns: { id: true, name: true },
                                        },
                                    },
                                },
                                user: {
                                    columns: { id: true, username: true, avatar: true },
                                },
                            },
                        });
                        return formatAndCacheData(tempNextFeed, "next_feed");
                    }
                };

                const [previousFeed, nextFeed] = await Promise.all([
                    getPreviousFeed(),
                    getNextFeed(),
                ]);
                return {
                    previousFeed,
                    nextFeed,
                };
            })
            .post('/:id', async ({
                admin,
                set,
                uid,
                params: { id },
                body: { title, listed, content, summary, alias, draft, top, tags, createdAt },
                store: { db, cache }
            }) => {
                const id_num = parseInt(id);
                const feed = await db.query.feeds.findFirst({
                    where: eq(feeds.id, id_num)
                });
                if (!feed) {
                    set.status = 404;
                    return 'Not found';
                }
                if (feed.uid !== uid && !admin) {
                    set.status = 403;
                    return 'Permission denied';
                }

                // Generate AI summary if content changed and not a draft
                let ai_summary: string | undefined = undefined;
                const contentChanged = content && content !== feed.content;
                const isDraft = draft !== undefined ? draft : (feed.draft === 1);
                if (contentChanged && !isDraft) {
                    const generatedSummary = await generateAISummary(db, content);
                    if (generatedSummary) {
                        ai_summary = generatedSummary;
                    }
                }
                // Also generate if publishing a draft for the first time
                if (!isDraft && feed.draft === 1 && !feed.ai_summary) {
                    const contentToSummarize = content || feed.content;
                    const generatedSummary = await generateAISummary(db, contentToSummarize);
                    if (generatedSummary) {
                        ai_summary = generatedSummary;
                    }
                }

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
                if (tags) {
                    await bindTagToPost(db, id_num, tags);
                }
                await clearFeedCache(cache, id_num, feed.alias, alias || null);
                return 'Updated';
            }, {
                body: t.Object({
                    title: t.Optional(t.String()),
                    alias: t.Optional(t.String()),
                    content: t.Optional(t.String()),
                    summary: t.Optional(t.String()),
                    listed: t.Boolean(),
                    draft: t.Optional(t.Boolean()),
                    createdAt: t.Optional(t.Date()),
                    tags: t.Optional(t.Array(t.String())),
                    top: t.Optional(t.Integer())
                })
            })
            .post('/top/:id', async ({
                admin,
                set,
                uid,
                params: { id },
                body: { top },
                store: { db, cache }
            }) => {
                const id_num = parseInt(id);
                const feed = await db.query.feeds.findFirst({
                    where: eq(feeds.id, id_num)
                });
                if (!feed) {
                    set.status = 404;
                    return 'Not found';
                }
                if (feed.uid !== uid && !admin) {
                    set.status = 403;
                    return 'Permission denied';
                }
                await db.update(feeds).set({
                    top
                }).where(eq(feeds.id, feed.id));
                await clearFeedCache(cache, feed.id, null, null);
                return 'Updated';
            }, {
                body: t.Object({
                    top: t.Integer()
                })
            })
            .delete('/:id', async ({ admin, set, uid, params: { id }, store: { db, cache } }) => {
                const id_num = parseInt(id);
                const feed = await db.query.feeds.findFirst({
                    where: eq(feeds.id, id_num)
                });
                if (!feed) {
                    set.status = 404;
                    return 'Not found';
                }
                if (feed.uid !== uid && !admin) {
                    set.status = 403;
                    return 'Permission denied';
                }
                await db.delete(feeds).where(eq(feeds.id, id_num));
                await clearFeedCache(cache, id_num, feed.alias, null);
                return 'Deleted';
            })
    )
    .get('/search/:keyword', async ({ admin, params: { keyword }, query: { page, limit }, store: { db, cache } }) => {
        keyword = decodeURI(keyword);
        const page_num = (page ? page > 0 ? page : 1 : 1) - 1;
        const limit_num = limit ? +limit > 50 ? 50 : +limit : 20;
        if (keyword === undefined || keyword.trim().length === 0) {
            return {
                size: 0,
                data: [],
                hasNext: false
            }
        }
        const cacheKey = `search_${keyword}`;
        const searchKeyword = `%${keyword}%`;
        const whereClause = or(like(feeds.title, searchKeyword),
            like(feeds.content, searchKeyword),
            like(feeds.summary, searchKeyword),
            like(feeds.alias, searchKeyword));
        const feed_list = (await cache.getOrSet(cacheKey, () => db.query.feeds.findMany({
            where: admin ? whereClause : and(whereClause, eq(feeds.draft, 0)),
            columns: admin ? undefined : {
                draft: false,
                listed: false
            },
            with: {
                hashtags: {
                    columns: {},
                    with: {
                        hashtag: {
                            columns: { id: true, name: true }
                        }
                    }
                }, user: {
                    columns: { id: true, username: true, avatar: true }
                }
            },
            orderBy: [desc(feeds.createdAt), desc(feeds.updatedAt)],
        }))).map(({ content, hashtags, summary, ...other }: { content: any, hashtags: any, summary: any, [key: string]: any }) => {
            return {
                summary: summary.length > 0 ? summary : content.length > 100 ? content.slice(0, 100) : content,
                hashtags: hashtags.map(({ hashtag }: { hashtag: any }) => hashtag),
                ...other
            }
        });
        if (feed_list.length <= page_num * limit_num) {
            return {
                size: feed_list.length,
                data: [],
                hasNext: false
            }
        } else if (feed_list.length <= page_num * limit_num + limit_num) {
            return {
                size: feed_list.length,
                data: feed_list.slice(page_num * limit_num),
                hasNext: false
            }
        } else {
            return {
                size: feed_list.length,
                data: feed_list.slice(page_num * limit_num, page_num * limit_num + limit_num),
                hasNext: true
            }
        }
    }, {
        query: t.Object({
            page: t.Optional(t.Numeric()),
            limit: t.Optional(t.Numeric()),
        })
    })
    .post('wp', async ({ set, admin, body: { data }, store: { db, cache } }) => {
        if (!admin) {
            set.status = 403;
            return 'Permission denied';
        }
        if (!data) {
            set.status = 400;
            return 'Data is required';
        }
        const xml = await data.text();
        const parser = new XMLParser();
        const result = await parser.parse(xml)
        const items = result.rss.channel.item;
        if (!items) {
            set.status = 404;
            return 'No items found';
        }
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
        let success = 0;
        let skipped = 0;
        let skippedList: { title: string, reason: string }[] = [];
        for (const item of feedItems) {
            if (!item.content) {
                skippedList.push({ title: item.title, reason: "no content" });
                skipped++;
                continue;
            }
            const exist = await db.query.feeds.findFirst({
                where: eq(feeds.content, item.content)
            });
            if (exist) {
                skippedList.push({ title: item.title, reason: "content exists" });
                skipped++;
                continue;
            }
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
            if (item.tags) {
                await bindTagToPost(db, result[0].insertedId, item.tags);
            }
            success++;
        }
        cache.deletePrefix('feeds_');
        return {
            success,
            skipped,
            skippedList
        };
    }, {
        body: t.Object({
            data: t.File()
        })
    })


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
    if (alias)
        await cache.delete(`feed_${alias}`, false);
    if (newAlias)
        await cache.delete(`feed_${newAlias}`, false);
}
