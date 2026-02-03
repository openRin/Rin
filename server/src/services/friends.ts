import { eq } from "drizzle-orm";
import type { DB } from "../context";
import * as schema from "../db/schema";
import { friends } from "../db/schema";
import { Router } from "../core/router";
import { t } from "../core/index";
import type { Context } from "../core/types";
import type { CacheImpl } from "../utils/cache";
import { Config } from "../utils/config";
import { notify } from "../utils/webhook";

export function FriendService(router: Router): void {
    router.group('/friend', (group) => {
        // GET /friend
        group.get('/', async (ctx: Context) => {
            const { admin, uid, store: { db } } = ctx;
            
            const friend_list = await (admin
                ? db.query.friends.findMany({
                    orderBy: (friends: any, { asc, desc }: { asc: any, desc: any }) => [
                        desc(friends.sort_order), 
                        asc(friends.createdAt)
                    ]
                })
                : db.query.friends.findMany({
                    where: eq(friends.accepted, 1),
                    orderBy: (friends: any, { asc, desc }: { asc: any, desc: any }) => [
                        desc(friends.sort_order), 
                        asc(friends.createdAt)
                    ]
                }));
                
            const apply_list = uid ? await db.query.friends.findFirst({ where: eq(friends.uid, uid) }) : null;
            return { friend_list, apply_list };
        });

        // POST /friend
        group.post('/', async (ctx: Context) => {
            const { admin, uid, username, set, body, store: { db, env, clientConfig, serverConfig } } = ctx;
            const { name, desc, avatar, url } = body;
            
            const enable = await clientConfig.getOrDefault('friend_apply_enable', true);
            if (!enable && !admin) {
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
                const exist = await db.query.friends.findFirst({ where: eq(friends.uid, uid) });
                if (exist) {
                    set.status = 400;
                    return 'Already sent';
                }
            }
            
            const accepted = admin ? 1 : 0;
            await db.insert(friends).values({
                name, desc, avatar, url, uid: uid, accepted
            });

            if (!admin) {
                const webhookUrl = await serverConfig.get(Config.webhookUrl) || env.WEBHOOK_URL;
                const content = `${env.FRONTEND_URL}/friends\n${username} 申请友链: ${name}\n${desc}\n${url}`;
                await notify(webhookUrl, content);
            }
            return 'OK';
        }, {
            type: 'object',
            properties: {
                name: { type: 'string' },
                desc: { type: 'string' },
                avatar: { type: 'string' },
                url: { type: 'string' }
            }
        });

        // PUT /friend/:id
        group.put('/:id', async (ctx: Context) => {
            const { admin, uid, username, set, params, body, store: { db, env, clientConfig, serverConfig } } = ctx;
            const { name, desc, avatar, url, accepted, sort_order } = body;
            
            const enable = await clientConfig.getOrDefault('friend_apply_enable', true);
            if (!enable && !admin) {
                set.status = 403;
                return 'Friend Link Apply Disabled';
            }
            
            if (!uid) {
                set.status = 401;
                return 'Unauthorized';
            }
            
            const exist = await db.query.friends.findFirst({ where: eq(friends.id, parseInt(params.id)) });
            if (!exist) {
                set.status = 404;
                return 'Not found';
            }
            
            if (!admin && exist.uid !== uid) {
                set.status = 403;
                return 'Permission denied';
            }
            
            let finalAccepted = accepted;
            let finalSortOrder = sort_order;
            
            if (!admin) {
                finalAccepted = 0;
                finalSortOrder = undefined;
            }
            
            function wrap(s: string | undefined) {
                return s ? s.length === 0 ? undefined : s : undefined;
            }
            
            await db.update(friends).set({
                name: wrap(name),
                desc: wrap(desc),
                avatar: wrap(avatar),
                url: wrap(url),
                accepted: finalAccepted === undefined ? undefined : finalAccepted,
                sort_order: finalSortOrder === undefined ? undefined : finalSortOrder,
            }).where(eq(friends.id, parseInt(params.id)));
            
            if (!admin) {
                const webhookUrl = await serverConfig.get(Config.webhookUrl) || env.WEBHOOK_URL;
                const content = `${env.FRONTEND_URL}/friends\n${username} 更新友链: ${name}\n${desc}\n${url}`;
                await notify(webhookUrl, content);
            }
            return 'OK';
        }, {
            type: 'object',
            properties: {
                name: { type: 'string' },
                desc: { type: 'string' },
                avatar: { type: 'string', optional: true },
                url: { type: 'string' },
                accepted: { type: 'number', optional: true },
                sort_order: { type: 'number', optional: true }
            }
        });

        // DELETE /friend/:id
        group.delete('/:id', async (ctx: Context) => {
            const { admin, uid, set, params, store: { db } } = ctx;
            
            if (!uid) {
                set.status = 401;
                return 'Unauthorized';
            }
            
            const exist = await db.query.friends.findFirst({ where: eq(friends.id, parseInt(params.id)) });
            if (!exist) {
                set.status = 404;
                return 'Not found';
            }
            
            if (!admin && exist.uid !== uid) {
                set.status = 403;
                return 'Permission denied';
            }
            
            await db.delete(friends).where(eq(friends.id, parseInt(params.id)));
            return 'OK';
        });
    });
}

export async function friendCrontab(
    env: Env,
    ctx: ExecutionContext,
    db: DB,
    cache: CacheImpl,
    serverConfig: CacheImpl,
    clientConfig: CacheImpl
) {
    const enable = await serverConfig.getOrDefault('friend_crontab', true);
    const ua = await serverConfig.get('friend_ua') || 'Rin-Check/0.1.0';
    
    if (!enable) {
        console.info('friend crontab disabled');
        return;
    }
    
    const friend_list = await db.query.friends.findMany();
    console.info(`total friends: ${friend_list.length}`);
    
    let health = 0;
    let unhealthy = 0;
    
    for (const friend of friend_list) {
        console.info(`checking ${friend.name}: ${friend.url}`);
        try {
            const response = await fetch(new Request(friend.url, { 
                method: 'GET', 
                headers: { 'User-Agent': ua } 
            }));
            console.info(`response status: ${response.status}`);
            console.info(`response statusText: ${response.statusText}`);
            
            if (response.ok) {
                ctx.waitUntil(db.update(schema.friends).set({ health: "" }).where(eq(schema.friends.id, friend.id)));
                health++;
            } else {
                ctx.waitUntil(db.update(schema.friends).set({ health: `${response.status}` }).where(eq(schema.friends.id, friend.id)));
                unhealthy++;
            }
        } catch (e: any) {
            console.error(e.message);
            ctx.waitUntil(db.update(schema.friends).set({ health: e.message }).where(eq(schema.friends.id, friend.id)));
            unhealthy++;
        }
    }
    
    console.info(`update friends health done. Total: ${health + unhealthy}, Healthy: ${health}, Unhealthy: ${unhealthy}`);
}
