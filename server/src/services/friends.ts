import { eq } from "drizzle-orm";
import Elysia, { t } from "elysia";
import type { DB } from "../_worker";
import { friends } from "../db/schema";
import { setup } from "../setup";
import type { Env } from "../db/db";

export const FriendService = (db: DB, env: Env) => new Elysia({ aot: false })
    .use(setup(db, env))
    .group('/friend', (group) =>
        group.get('/', async ({ admin, uid }) => {
            const friend_list = await (admin ? db.query.friends.findMany() : db.query.friends.findMany({ where: eq(friends.accepted, 1) }));
            console.log(friend_list);
            const apply_list = await db.query.friends.findFirst({ where: eq(friends.uid, uid ?? null) });
            console.log(apply_list);
            return { friend_list, apply_list };
        })
            .post('/', async ({ admin, uid, set, body: { name, desc, avatar, url } }) => {
                if (name.length > 20 || desc.length > 100 || avatar.length > 100 || url.length > 100) {
                    set.status = 400;
                    return 'Invalid input';
                }
                if (name.length === 0 || desc.length === 0 || avatar.length === 0 || url.length === 0) {
                    set.status = 400;
                    return 'Invalid input';
                }
                if (!uid) {
                    set.status = 401;
                    return 'Unauthorized';
                }
                if (!admin) {
                    const exist = await db.query.friends.findFirst({
                        where: eq(friends.uid, uid),
                    });
                    if (exist) {
                        set.status = 400;
                        return 'Already sent';
                    }
                }
                const uid_num = parseInt(uid);
                const accepted = admin ? 1 : 0;
                await db.insert(friends).values({
                    name,
                    desc,
                    avatar,
                    url,
                    uid: uid_num,
                    accepted,
                });
                return 'OK';
            }, {
                body: t.Object({
                    name: t.String(),
                    desc: t.String(),
                    avatar: t.String(),
                    url: t.String(),
                })
            })
            .put('/:id', async ({ admin, uid, set, params: { id }, body: { name, desc, avatar, url, accepted } }) => {
                if (!uid) {
                    set.status = 401;
                    return 'Unauthorized';
                }
                const exist = await db.query.friends.findFirst({
                    where: eq(friends.id, parseInt(id)),
                });
                if (!exist) {
                    set.status = 404;
                    return 'Not found';
                }
                if (!admin && exist.uid !== uid) {
                    set.status = 403;
                    return 'Permission denied';
                }
                if (!admin) {
                    accepted = 0;
                }
                await db.update(friends).set({
                    name,
                    desc,
                    avatar,
                    url,
                    accepted,
                }).where(eq(friends.id, parseInt(id)));
                return 'OK';
            }, {
                body: t.Object({
                    name: t.String(),
                    desc: t.String(),
                    avatar: t.Optional(t.String()),
                    url: t.String(),
                    accepted: t.Optional(t.Integer()),
                })
            })
            .delete('/:id', async ({ admin, uid, set, params: { id } }) => {
                if (!uid) {
                    set.status = 401;
                    return 'Unauthorized';
                }
                const exist = await db.query.friends.findFirst({
                    where: eq(friends.id, parseInt(id)),
                });
                if (!exist) {
                    set.status = 404;
                    return 'Not found';
                }
                if (!admin && exist.uid !== uid) {
                    set.status = 403;
                    return 'Permission denied';
                }
                await db.delete(friends).where(eq(friends.id, parseInt(id)));
                return 'OK';
            })
    )