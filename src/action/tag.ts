import Elysia, { t } from "elysia";
import db from "../db/db";
import { hashtags } from "../db/schema";

export const TagService = new Elysia()
    .group('/tag', (group) =>
        group.get('/', async () => {
            const tag_list = await db.query.hashtags.findMany();
            return tag_list;
        })
            .post('/', async ({ body: { name } }) => {
                const result = await db.insert(hashtags).values({
                    name
                }).returning({ insertedId: hashtags.id });
                if (result.length === 0) {
                    throw new Error('Failed to insert');
                } else {
                    return result[0].insertedId;
                }
            }, {
                body: t.Object({
                    name: t.String(),
                })
            })
    );
