import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { startTime, endTime } from "hono/timing";
import type { AppContext, DB } from "../core/hono-types";
import * as schema from "../db/schema";
import { friends } from "../db/schema";
import type { CacheImpl } from "../utils/cache";
import { Config } from "../utils/config";
import { notify } from "../utils/webhook";

export function FriendService(): Hono {
    const app = new Hono();

    // GET /friend
    app.get('/', async (c: AppContext) => {
        startTime(c, 'friend-list');
        const admin = c.get('admin');
        const uid = c.get('uid');
        const db = c.get('db');
        
        startTime(c, 'db-query');
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
        endTime(c, 'db-query');
            
        startTime(c, 'db-apply-query');
        const apply_list = uid ? await db.query.friends.findFirst({ where: eq(friends.uid, uid) }) : null;
        endTime(c, 'db-apply-query');
        endTime(c, 'friend-list');
        return c.json({ friend_list, apply_list });
    });

    // POST /friend
    app.post('/', async (c: AppContext) => {
        startTime(c, 'friend-create');
        const admin = c.get('admin');
        const uid = c.get('uid');
        const username = c.get('username');
        const db = c.get('db');
        const env = c.get('env');
        const clientConfig = c.get('clientConfig');
        const serverConfig = c.get('serverConfig');
        const body = await c.req.json();
        const { name, desc, avatar, url } = body;
        
        startTime(c, 'config-get');
        const enable = await clientConfig.getOrDefault('friend_apply_enable', true);
        endTime(c, 'config-get');
        if (!enable && !admin) {
            endTime(c, 'friend-create');
            return c.text('Friend Link Apply Disabled', 403);
        }
        
        if (name.length > 20 || desc.length > 100 || avatar.length > 100 || url.length > 100) {
            endTime(c, 'friend-create');
            return c.text('Invalid input', 400);
        }
        
        if (name.length === 0 || desc.length === 0 || avatar.length === 0 || url.length === 0) {
            endTime(c, 'friend-create');
            return c.text('Invalid input', 400);
        }
        
        if (!uid) {
            endTime(c, 'friend-create');
            return c.text('Unauthorized', 401);
        }
        
        if (!admin) {
            startTime(c, 'db-check-exist');
            const exist = await db.query.friends.findFirst({ where: eq(friends.uid, uid) });
            endTime(c, 'db-check-exist');
            if (exist) {
                endTime(c, 'friend-create');
                return c.text('Already sent', 400);
            }
        }
        
        const accepted = admin ? 1 : 0;
        startTime(c, 'db-insert');
        await db.insert(friends).values({
            name, desc, avatar, url, uid: uid, accepted
        });
        endTime(c, 'db-insert');

        if (!admin) {
            startTime(c, 'config-get-webhook');
            const webhookUrl = await serverConfig.get(Config.webhookUrl) || env.WEBHOOK_URL;
            endTime(c, 'config-get-webhook');
            const frontendUrl = new URL(c.req.url).origin;
            startTime(c, 'webhook-notify');
            await notify(webhookUrl, `${frontendUrl}/friends\n${username} 申请友链: ${name}\n${desc}\n${url}`);
            endTime(c, 'webhook-notify');
        }
        endTime(c, 'friend-create');
        return c.text('OK');
    });

    // PUT /friend/:id
    app.put('/:id', async (c: AppContext) => {
        startTime(c, 'friend-update');
        const admin = c.get('admin');
        const uid = c.get('uid');
        const username = c.get('username');
        const db = c.get('db');
        const env = c.get('env');
        const clientConfig = c.get('clientConfig');
        const serverConfig = c.get('serverConfig');
        const id = c.req.param('id');
        const body = await c.req.json();
        const { name, desc, avatar, url, accepted, sort_order } = body;
        
        startTime(c, 'config-get');
        const enable = await clientConfig.getOrDefault('friend_apply_enable', true);
        endTime(c, 'config-get');
        if (!enable && !admin) {
            endTime(c, 'friend-update');
            return c.text('Friend Link Apply Disabled', 403);
        }
        
        if (!uid) {
            endTime(c, 'friend-update');
            return c.text('Unauthorized', 401);
        }
        
        startTime(c, 'db-query');
        const exist = await db.query.friends.findFirst({ where: eq(friends.id, parseInt(id)) });
        endTime(c, 'db-query');
        if (!exist) {
            endTime(c, 'friend-update');
            return c.text('Not found', 404);
        }
        
        if (!admin && exist.uid !== uid) {
            endTime(c, 'friend-update');
            return c.text('Permission denied', 403);
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
        
        startTime(c, 'db-update');
        await db.update(friends).set({
            name: wrap(name),
            desc: wrap(desc),
            avatar: wrap(avatar),
            url: wrap(url),
            accepted: finalAccepted === undefined ? undefined : finalAccepted,
            sort_order: finalSortOrder === undefined ? undefined : finalSortOrder,
        }).where(eq(friends.id, parseInt(id)));
        endTime(c, 'db-update');
        
        if (!admin) {
            startTime(c, 'config-get-webhook');
            const webhookUrl = await serverConfig.get(Config.webhookUrl) || env.WEBHOOK_URL;
            endTime(c, 'config-get-webhook');
            const frontendUrl = new URL(c.req.url).origin;
            startTime(c, 'webhook-notify');
            await notify(webhookUrl, `${frontendUrl}/friends\n${username} 更新友链: ${name}\n${desc}\n${url}`);
            endTime(c, 'webhook-notify');
        }
        endTime(c, 'friend-update');
        return c.text('OK');
    });

    // DELETE /friend/:id
    app.delete('/:id', async (c: AppContext) => {
        startTime(c, 'friend-delete');
        const admin = c.get('admin');
        const uid = c.get('uid');
        const db = c.get('db');
        const id = c.req.param('id');
        
        if (!uid) {
            endTime(c, 'friend-delete');
            return c.text('Unauthorized', 401);
        }
        
        startTime(c, 'db-query');
        const exist = await db.query.friends.findFirst({ where: eq(friends.id, parseInt(id)) });
        endTime(c, 'db-query');
        if (!exist) {
            endTime(c, 'friend-delete');
            return c.text('Not found', 404);
        }
        
        if (!admin && exist.uid !== uid) {
            endTime(c, 'friend-delete');
            return c.text('Permission denied', 403);
        }
        
        startTime(c, 'db-delete');
        await db.delete(friends).where(eq(friends.id, parseInt(id)));
        endTime(c, 'db-delete');
        endTime(c, 'friend-delete');
        return c.text('OK');
    });

    return app;
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
