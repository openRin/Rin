import { and, eq } from "drizzle-orm";
import Elysia from "elysia";
import type { DB } from "../_worker";
import { feedHashtags, hashtags } from "../db/schema";
import { getDB } from "../utils/di";
import { setup } from "../setup";

export function TagService() {
    const db: DB = getDB();
    return new Elysia({ aot: false })
        .use(setup())
        .group('/tag', (group) =>
            group
                .get('/', async () => {
                    const tag_list = await db.query.hashtags.findMany({
                        with: {
                            feeds: {
                                columns: { feedId: true }
                            }
                        }
                    });
                    return tag_list.map((tag) => {
                        return {
                            ...tag,
                            feeds: tag.feeds.length
                        }
                    })
                })
                .get('/:name', async ({ admin, set, params: { name } }) => {
                    const nameDecoded = decodeURI(name)
                    const tag = await db.query.hashtags.findFirst({
                        where: eq(hashtags.name, nameDecoded),
                        with: {
                            feeds: {
                                with: {
                                    feed: {
                                        columns: {
                                            id: true, title: true, summary: true, content: true, createdAt: true, updatedAt: true,
                                            draft: false,
                                            listed: false
                                        },
                                        with: {
                                            user: {
                                                columns: { id: true, username: true, avatar: true }
                                            },
                                            hashtags: {
                                                columns: {},
                                                with: {
                                                    hashtag: {
                                                        columns: { id: true, name: true }
                                                    }
                                                }
                                            }
                                        },
                                        where: (feeds: any) => admin ? undefined : and(eq(feeds.draft, 0), eq(feeds.listed, 1)),
                                    } as any
                                }
                            }
                        }
                    });
                    const tagFeeds = tag?.feeds.map((tag: any) => {
                        if (!tag.feed) {
                            return null;
                        }
                        return {
                            ...tag.feed,
                            hashtags: tag.feed.hashtags.map((tag: any) => tag.hashtag)
                        }
                    }).filter((feed: any) => feed !== null);
                    if (!tag) {
                        set.status = 404;
                        return 'Not found';
                    }
                    return {
                        ...tag,
                        feeds: tagFeeds
                    };
                })
        );
}


export async function bindTagToPost(db: DB, feedId: number, tags: string[]) {
    await db.delete(feedHashtags).where(
        eq(feedHashtags.feedId, feedId));
    for (const tag of tags) {
        const tagId = await getTagIdOrCreate(db, tag);
        await db.insert(feedHashtags).values({
            feedId: feedId,
            hashtagId: tagId
        });
    }
}

async function getTagByName(db: DB, name: string) {
    return await db.query.hashtags.findFirst({ where: eq(hashtags.name, name) });
}

async function getTagIdOrCreate(db: DB, name: string) {
    const tag = await getTagByName(db, name)
    if (tag) {
        return tag.id;
    } else {
        const result = await db.insert(hashtags).values({
            name
        }).returning({ insertedId: hashtags.id });
        if (result.length === 0) {
            throw new Error('Failed to insert');
        } else {
            return result[0].insertedId;
        }
    }
}