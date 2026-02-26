import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { startTime, endTime } from "hono/timing";
import type { DB } from "../core/hono-types";
import { feedHashtags, hashtags } from "../db/schema";
import type { AppContext } from "../core/hono-types";

export function TagService(): Hono {
    const app = new Hono();

    // GET /tag
    app.get('/', async (c: AppContext) => {
        startTime(c, 'tag-list');
        const db = c.get('db');
        
        startTime(c, 'db-query');
        const tag_list = await db.query.hashtags.findMany({
            with: {
                feeds: { columns: { feedId: true } }
            }
        });
        endTime(c, 'db-query');
        
        const result = tag_list.map((tag: any) => ({
            ...tag,
            feeds: tag.feeds.length
        }));
        
        endTime(c, 'tag-list');
        return c.json(result);
    });

    // GET /tag/:name
    app.get('/:name', async (c: AppContext) => {
        startTime(c, 'tag-get');
        const db = c.get('db');
        const admin = c.get('admin');
        const nameDecoded = decodeURI(c.req.param('name'));
        
        startTime(c, 'db-query');
        const tag = await db.query.hashtags.findFirst({
            where: eq(hashtags.name, nameDecoded),
            with: {
                feeds: {
                    with: {
                        feed: {
                            columns: {
                                id: true, title: true, summary: true, content: true, 
                                createdAt: true, updatedAt: true, draft: false, listed: false
                            },
                            with: {
                                user: { columns: { id: true, username: true, avatar: true } },
                                hashtags: {
                                    columns: {},
                                    with: { hashtag: { columns: { id: true, name: true } } }
                                }
                            },
                            where: (feeds: any) => admin ? undefined : and(eq(feeds.draft, 0), eq(feeds.listed, 1))
                        } as any
                    }
                }
            }
        });
        endTime(c, 'db-query');
        
        if (!tag) {
            endTime(c, 'tag-get');
            return c.text('Not found', 404);
        }
        
        const tagFeeds = tag?.feeds.map((tagFeed: any) => {
            if (!tagFeed.feed) return null;
            return {
                ...tagFeed.feed,
                hashtags: tagFeed.feed.hashtags.map((hashtag: any) => hashtag.hashtag)
            };
        }).filter((feed: any) => feed !== null);
        
        endTime(c, 'tag-get');
        return c.json({ ...tag, feeds: tagFeeds });
    });

    return app;
}

export async function bindTagToPost(db: DB, feedId: number, tags: string[]) {
    await db.delete(feedHashtags).where(eq(feedHashtags.feedId, feedId));
    
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
    const tag = await getTagByName(db, name);
    if (tag) {
        return tag.id;
    } else {
        const result = await db.insert(hashtags).values({ name }).returning({ insertedId: hashtags.id });
        if (result.length === 0) {
            throw new Error('Failed to insert');
        } else {
            return result[0].insertedId;
        }
    }
}
