import {and, count, desc, eq, or} from "drizzle-orm";
import Elysia, {t} from "elysia";
import type {DB} from "../_worker";
import type {Env} from "../db/db";
import {feeds} from "../db/schema";
import {setup} from "../setup";
import {extractImage} from "../utils/image";
import {bindTagToPost} from "./tag";
import html2md from 'html-to-md'
import {XMLParser} from "fast-xml-parser";

export const FeedService = (db: DB, env: Env) => new Elysia({aot: false})
    .use(setup(db, env))
    .group('/feed', (group) =>
        group
            .get('/', async ({admin, set, query: {page, limit, type}}) => {
                if ((type === 'draft' || type === 'unlisted') && !admin) {
                    set.status = 403;
                    return 'Permission denied';
                }
                const page_num = (page ? page > 0 ? page : 1 : 1) - 1;
                const limit_num = limit ? +limit > 50 ? 50 : +limit : 20;
                const where = type === 'draft' ? eq(feeds.draft, 1) : type === 'unlisted' ? and(eq(feeds.draft, 0), eq(feeds.listed, 0)) : and(eq(feeds.draft, 0), eq(feeds.listed, 1));
                const size = await db.select({count: count()}).from(feeds).where(where);
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
                                    columns: {id: true, name: true}
                                }
                            }
                        }, user: {
                            columns: {id: true, username: true, avatar: true}
                        }
                    },
                    orderBy: [desc(feeds.createdAt), desc(feeds.updatedAt)],
                    offset: page_num * limit_num,
                    limit: limit_num + 1,
                })).map(({content, hashtags, summary, ...other}) => {
                    // 提取首图
                    const avatar = extractImage(content);
                    return {
                        summary: summary.length > 0 ? summary : content.length > 100 ? content.slice(0, 100) : content,
                        hashtags: hashtags.map(({hashtag}) => hashtag),
                        avatar,
                        ...other
                    }
                });
                if (feed_list.length === limit_num + 1) {
                    feed_list.pop();
                    return {
                        size: size[0].count,
                        data: feed_list,
                        hasNext: true
                    }
                } else {
                    return {
                        size: size[0].count,
                        data: feed_list,
                        hasNext: false
                    }
                }
            }, {
                query: t.Object({
                    page: t.Optional(t.Numeric()),
                    limit: t.Optional(t.Numeric()),
                    type: t.Optional(t.String())
                })
            })
            .get('/timeline', async () => {
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
            .post('/', async ({admin, set, uid, body: {title, alias, listed, content, summary, draft, tags}}) => {
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

                const result = await db.insert(feeds).values({
                    title,
                    content,
                    summary,
                    uid,
                    alias,
                    listed: listed ? 1 : 0,
                    draft: draft ? 1 : 0
                }).returning({insertedId: feeds.id});
                await bindTagToPost(db, result[0].insertedId, tags);
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
                    tags: t.Array(t.String())
                })
            })
            .get('/:id', async ({uid, admin, set, params: {id}}) => {
                const id_num = parseInt(id);
                const feed = (await db.query.feeds.findFirst({
                    where: or(eq(feeds.id, id_num), eq(feeds.alias, id)),
                    with: {
                        hashtags: {
                            columns: {},
                            with: {
                                hashtag: {
                                    columns: {id: true, name: true}
                                }
                            }
                        }, user: {
                            columns: {id: true, username: true, avatar: true}
                        }
                    }
                }));
                if (!feed) {
                    set.status = 404;
                    return 'Not found';
                }
                // permission check
                if (feed.draft && feed.uid !== uid && !admin) {
                    set.status = 403;
                    return 'Permission denied';
                }

                const {hashtags, ...other} = feed;
                const hashtags_flatten = hashtags.map(({hashtag}) => hashtag);
                return {
                    ...other,
                    hashtags: hashtags_flatten
                };
            })
            .post('/:id', async ({
                                     admin,
                                     set,
                                     uid,
                                     params: {id},
                                     body: {title, listed, content, summary, alias, draft, tags}
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
                    title,
                    content,
                    summary,
                    alias,
                    listed: listed ? 1 : 0,
                    draft: draft ? 1 : 0,
                    updatedAt: new Date()
                }).where(eq(feeds.id, id_num));
                if (tags) {
                    await bindTagToPost(db, id_num, tags);
                }
                return 'Updated';
            }, {
                body: t.Object({
                    title: t.Optional(t.String()),
                    alias: t.Optional(t.String()),
                    content: t.Optional(t.String()),
                    summary: t.Optional(t.String()),
                    listed: t.Boolean(),
                    draft: t.Optional(t.Boolean()),
                    tags: t.Optional(t.Array(t.String()))
                })
            })
            .delete('/:id', async ({admin, set, uid, params: {id}}) => {
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
                return 'Deleted';
            })
    )
    .post('wp', async ({set, admin, body: {data}}) => {
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
            const draft = item?.['wp:status'] != 'publish';
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
                skippedList.push({title: item.title, reason: "no content"});
                skipped++;
                continue;
            }
            const exist = await db.query.feeds.findFirst({
                where: eq(feeds.content, item.content)
            });
            if (exist) {
                skippedList.push({title: item.title, reason: "content exists"});
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
            }).returning({insertedId: feeds.id});
            if (item.tags) {
                await bindTagToPost(db, result[0].insertedId, item.tags);
            }
            success++;
        }
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