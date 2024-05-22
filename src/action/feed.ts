import { eq } from "drizzle-orm";
import Elysia, { t } from "elysia";
import db from "../db/db";
import { feeds } from "../db/schema";
import { setup } from "../setup";

export const FeedService = new Elysia()
    .use(setup)
    .group('/feed', (group) =>
        group
            .get('/', async () => {
                const feed_list = (await db.query.feeds.findMany({
                    where: eq(feeds.draft, 0)
                })).map(({ draft, ...other }) => {
                    return other;
                });
                return feed_list;
            })
            .post('/', async ({ admin, set, body: { title, content, draft } }) => {
                if (!admin) {
                    set.status = 403;
                    return 'Permission denied';
                }
                const result = await db.insert(feeds).values({
                    title,
                    content,
                    draft: draft ? 1 : 0
                }).returning({ insertedId: feeds.id });
                if (result.length === 0) {
                    set.status = 500;
                    return 'Failed to insert';
                } else {
                    return result[0].insertedId;
                }
            }, {
                body: t.Object({
                    title: t.String(),
                    content: t.String(),
                    draft: t.Boolean()
                })
            })
            .get('/:id', async ({ set, params: { id } }) => {
                const id_num = parseInt(id);
                const feed = await db.query.feeds.findFirst({
                    where: eq(feeds.id, id_num)
                });
                if (!feed) {
                    set.status = 404;
                    return 'Not found';
                }
                return feed;
            })

    )