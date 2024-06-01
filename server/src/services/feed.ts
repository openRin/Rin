import { and, desc, eq, or } from "drizzle-orm";
import Elysia, { t } from "elysia";
import type { DB } from "../_worker";
import { feeds } from "../db/schema";
import { setup } from "../setup";
import { bindTagToPost } from "./tag";
import type { Env } from "../db/db";

export const FeedService = (db: DB, env: Env) => new Elysia({ aot: false })
    .use(setup(db, env))
    .group('/feed', (group) =>
        group
            .get('/', async ({ admin }) => {
                const feed_list = (await db.query.feeds.findMany({
                    where: admin ? undefined : and(eq(feeds.draft, 0), eq(feeds.listed, 1)),
                    columns: admin ? undefined : {
                        draft: false
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
                    orderBy: [desc(feeds.updatedAt), desc(feeds.createdAt)]
                })).map(({ content, hashtags, summary, ...other }) => {
                    // 提取首图
                    const img_reg = /!\[.*?\]\((.*?)\)/;
                    const img_match = img_reg.exec(content);
                    let avatar: string | undefined = undefined;
                    if (img_match) {
                        avatar = img_match[1];
                    }
                    return {
                        summary: summary.length > 0 ? summary : content.length > 100 ? content.slice(0, 100) : content,
                        hashtags: hashtags.map(({ hashtag }) => hashtag),
                        avatar,
                        ...other
                    }
                });
                return feed_list;
            })
            .post('/', async ({ admin, set, uid, body: { title, alias, listed, content, summary, draft, tags } }) => {
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
                }).returning({ insertedId: feeds.id });
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
            .get('/:id', async ({ uid, admin, set, params: { id } }) => {
                const id_num = parseInt(id);
                const feed = (await db.query.feeds.findFirst({
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

                const { hashtags, ...other } = feed;
                const hashtags_flatten = hashtags.map(({ hashtag }) => hashtag);
                return {
                    ...other,
                    hashtags: hashtags_flatten
                };
            })
            .post('/:id', async ({ admin, set, uid, params: { id }, body: { title, listed, content, summary, alias, draft, tags } }) => {
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

    );