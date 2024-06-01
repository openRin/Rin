import { eq } from "drizzle-orm";
import Elysia from "elysia";
import type { DB } from "../_worker";
import { feedHashtags, hashtags } from "../db/schema";

export const TagService = (db: DB) => new Elysia({ aot: false })
    .group('/tag', (group) =>
        group
            .get('/', async () => {
                const tag_list = await db.query.hashtags.findMany();
                return tag_list;
            })
            .get('/:name', async ({ set, params: { name } }) => {
                const tag = await db.query.hashtags.findFirst({
                    where: eq(hashtags.name, name),
                    with: { feeds: true }
                });
                if (!tag) {
                    set.status = 404;
                    return 'Not found';
                }
                return tag;
            })
    );


export async function bindTagToPost(db: DB, feedId: number, tags: string[]) {
    await db.delete(feedHashtags).where(
        eq(feedHashtags.feedId, feedId));
    tags.forEach(async (tag) => {
        const tagId = await getTagIdOrCreate(db, tag);
        await db.insert(feedHashtags).values({
            feedId: feedId,
            hashtagId: tagId
        });
    });
}

function getTagByName(db: DB, name: string) {
    return db.query.hashtags.findFirst({ where: eq(hashtags.name, name) });
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