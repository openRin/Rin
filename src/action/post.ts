import { eq } from "drizzle-orm";
import Elysia, { t } from "elysia";
import db from "../db/db";
import { posts } from "../db/schema";
import { setup } from "../setup";

export const PostService = new Elysia()
    .use(setup)
    .group('/post', (group) =>
        group
            .get('/', async () => {
                const post_list = (await db.query.posts.findMany({
                    where: eq(posts.draft, 0)
                })).map(({ draft, ...other }) => {
                    return other;
                });
                return post_list;
            })
            .post('/', async ({ admin, set, body: { title, content, draft } }) => {
                if (!admin) {
                    set.status = 403;
                    return 'Permission denied';
                }
                const result = await db.insert(posts).values({
                    title,
                    content,
                    draft: draft ? 1 : 0
                }).returning({ insertedId: posts.id });
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
                const post = await db.query.posts.findFirst({
                    where: eq(posts.id, id_num)
                });
                if (!post) {
                    set.status = 404;
                    return 'Not found';
                }
                return post;
            })
    );

