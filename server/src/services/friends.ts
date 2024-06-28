import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import Elysia, { t } from "elysia";
import type { DB } from "../_worker";
import type { Env } from "../db/db";
import * as schema from "../db/schema";
import { friends } from "../db/schema";
import { setup } from "../setup";
import { getDB } from "../utils/di";
import { ClientConfig, ServerConfig } from "../utils/cache";

export function FriendService() {
    const db: DB = getDB();
    return new Elysia({ aot: false })
        .use(setup())
        .group('/friend', (group) =>
            group.get('/', async ({ admin, uid }) => {
                const friend_list = await (admin ? db.query.friends.findMany() : db.query.friends.findMany({ where: eq(friends.accepted, 1) }));
                console.log(friend_list);
                const uid_num = parseInt(uid);
                const apply_list = await db.query.friends.findFirst({ where: eq(friends.uid, uid_num ?? null) });
                console.log(apply_list);
                return { friend_list, apply_list };
            })
                .post('/', async ({ admin, uid, set, body: { name, desc, avatar, url } }) => {
                    const config = ClientConfig()
                    const enable = await config.getOrDefault('friend_apply_enable', true)
                    if (!enable) {
                        set.status = 403;
                        return 'Friend Link Apply Disabled';
                    }
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
                    const config = ClientConfig()
                    const enable = await config.getOrDefault('friend_apply_enable', true)
                    if (!enable) {
                        set.status = 403;
                        return 'Friend Link Apply Disabled';
                    }
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
                    function wrap(s: string | undefined) {
                        return s ? s.length === 0 ? undefined : s : undefined;
                    }
                    await db.update(friends).set({
                        name: wrap(name),
                        desc: wrap(desc),
                        avatar: wrap(avatar),
                        url: wrap(url),
                        accepted: accepted === undefined ? undefined : accepted,
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
}

export async function friendCrontab(env: Env, ctx: ExecutionContext) {
    const config = ServerConfig()
    const enable = await config.getOrDefault('friend_crontab', true)
    const ua = await config.get('friend_ua') || 'Rin-Check/0.1.0'
    if (!enable) {
        console.info('friend crontab disabled')
        return
    }
    const db = drizzle(env.DB, { schema: schema })
    const friend_list = await db.query.friends.findMany()
    console.info(`total friends: ${friend_list.length}`)
    let health = 0
    let unhealthy = 0
    for (const friend of friend_list) {
        console.info(`checking ${friend.name}: ${friend.url}`)
        try {
            const response = await fetch(new Request(friend.url, { method: 'GET', headers: { 'User-Agent': ua } }))
            console.info(`response status: ${response.status}`)
            console.info(`response statusText: ${response.statusText}`)
            if (response.ok) {
                ctx.waitUntil(db.update(schema.friends).set({ health: "" }).where(eq(schema.friends.id, friend.id)))
                health++
            } else {
                ctx.waitUntil(db.update(schema.friends).set({ health: `${response.status}` }).where(eq(schema.friends.id, friend.id)))
                unhealthy++
            }
        } catch (e: any) {
            console.error(e.message)
            ctx.waitUntil(db.update(schema.friends).set({ health: e.message }).where(eq(schema.friends.id, friend.id)))
            unhealthy++
        }
    }
    console.info(`update friends health done. Total: ${health + unhealthy}, Healthy: ${health}, Unhealthy: ${unhealthy}`)
}