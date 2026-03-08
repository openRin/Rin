import { eq } from "drizzle-orm";
import { Hono } from "hono";
import type { AppContext, CacheImpl, DB } from "../core/hono-types";
import { profileAsync } from "../core/server-timing";
import * as schema from "../db/schema";
import { friends } from "../db/schema";
import { notify } from "../utils/webhook";
import { resolveWebhookConfig } from "./config-helpers";

export function FriendService(): Hono {
    const app = new Hono();

    // GET /friend
    app.get('/', async (c: AppContext) => {
        const admin = c.get('admin');
        const uid = c.get('uid');
        const db = c.get('db');
        
        const friend_list = await profileAsync(c, 'friend_list_db', () => (admin
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
            })));
            
        const apply_list = uid ? await profileAsync(c, 'friend_apply_lookup', () => db.query.friends.findFirst({ where: eq(friends.uid, uid) })) : null;
        return c.json({ friend_list, apply_list });
    });

    // POST /friend
    app.post('/', async (c: AppContext) => {
        const admin = c.get('admin');
        const uid = c.get('uid');
        const username = c.get('username');
        const db = c.get('db');
        const env = c.get('env');
        const clientConfig = c.get('clientConfig');
        const serverConfig = c.get('serverConfig');
        const body = await profileAsync(c, 'friend_create_parse', () => c.req.json());
        const { name, desc, avatar, url } = body;
        
        const enable = await profileAsync(c, 'friend_create_config', () => clientConfig.getOrDefault('friend_apply_enable', true));
        if (!enable && !admin) {
            return c.text('Friend Link Apply Disabled', 403);
        }
        
        if (name.length > 20 || desc.length > 100 || avatar.length > 100 || url.length > 100) {
            return c.text('Invalid input', 400);
        }
        
        if (name.length === 0 || desc.length === 0 || avatar.length === 0 || url.length === 0) {
            return c.text('Invalid input', 400);
        }
        
        if (!uid) {
            return c.text('Unauthorized', 401);
        }
        
        if (!admin) {
            const exist = await profileAsync(c, 'friend_create_existing', () => db.query.friends.findFirst({ where: eq(friends.uid, uid) }));
            if (exist) {
                return c.text('Already sent', 400);
            }
        }
        
        const accepted = admin ? 1 : 0;
        await profileAsync(c, 'friend_create_insert', () => db.insert(friends).values({
            name, desc, avatar, url, uid: uid, accepted
        }));

        if (!admin) {
            const {
                webhookUrl,
                webhookMethod,
                webhookContentType,
                webhookHeaders,
                webhookBodyTemplate,
            } = await profileAsync(c, 'friend_create_webhook_config', () => resolveWebhookConfig(serverConfig, env));
            const frontendUrl = new URL(c.req.url).origin;
            const content = `${frontendUrl}/friends\n${username} 申请友链: ${name}\n${desc}\n${url}`;
            await profileAsync(c, 'friend_create_notify', () => notify(
                webhookUrl || "",
                {
                    event: "friend.created",
                    message: content,
                    title: name,
                    url: `${frontendUrl}/friends`,
                    username: username || "",
                    content: url,
                    description: desc,
                },
                {
                    method: webhookMethod,
                    contentType: webhookContentType,
                    headers: webhookHeaders,
                    bodyTemplate: webhookBodyTemplate,
                },
            ));
        }
        return c.text('OK');
    });

    // PUT /friend/:id
    app.put('/:id', async (c: AppContext) => {
        const admin = c.get('admin');
        const uid = c.get('uid');
        const username = c.get('username');
        const db = c.get('db');
        const env = c.get('env');
        const clientConfig = c.get('clientConfig');
        const serverConfig = c.get('serverConfig');
        const id = c.req.param('id');
        const body = await profileAsync(c, 'friend_update_parse', () => c.req.json());
        const { name, desc, avatar, url, accepted, sort_order } = body;
        
        const enable = await profileAsync(c, 'friend_update_config', () => clientConfig.getOrDefault('friend_apply_enable', true));
        if (!enable && !admin) {
            return c.text('Friend Link Apply Disabled', 403);
        }
        
        if (!uid) {
            return c.text('Unauthorized', 401);
        }
        
        const exist = await profileAsync(c, 'friend_update_lookup', () => db.query.friends.findFirst({ where: eq(friends.id, parseInt(id)) }));
        if (!exist) {
            return c.text('Not found', 404);
        }
        
        if (!admin && exist.uid !== uid) {
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
        
        await profileAsync(c, 'friend_update_db', () => db.update(friends).set({
            name: wrap(name),
            desc: wrap(desc),
            avatar: wrap(avatar),
            url: wrap(url),
            accepted: finalAccepted === undefined ? undefined : finalAccepted,
            sort_order: finalSortOrder === undefined ? undefined : finalSortOrder,
        }).where(eq(friends.id, parseInt(id))));
        
        if (!admin) {
            const {
                webhookUrl,
                webhookMethod,
                webhookContentType,
                webhookHeaders,
                webhookBodyTemplate,
            } = await profileAsync(c, 'friend_update_webhook_config', () => resolveWebhookConfig(serverConfig, env));
            const frontendUrl = new URL(c.req.url).origin;
            const content = `${frontendUrl}/friends\n${username} 更新友链: ${name}\n${desc}\n${url}`;
            await profileAsync(c, 'friend_update_notify', () => notify(
                webhookUrl || "",
                {
                    event: "friend.updated",
                    message: content,
                    title: name,
                    url: `${frontendUrl}/friends`,
                    username: username || "",
                    content: url,
                    description: desc,
                },
                {
                    method: webhookMethod,
                    contentType: webhookContentType,
                    headers: webhookHeaders,
                    bodyTemplate: webhookBodyTemplate,
                },
            ));
        }
        return c.text('OK');
    });

    // DELETE /friend/:id
    app.delete('/:id', async (c: AppContext) => {
        const admin = c.get('admin');
        const uid = c.get('uid');
        const db = c.get('db');
        const id = c.req.param('id');
        
        if (!uid) {
            return c.text('Unauthorized', 401);
        }
        
        const exist = await profileAsync(c, 'friend_delete_lookup', () => db.query.friends.findFirst({ where: eq(friends.id, parseInt(id)) }));
        if (!exist) {
            return c.text('Not found', 404);
        }
        
        if (!admin && exist.uid !== uid) {
            return c.text('Permission denied', 403);
        }
        
        await profileAsync(c, 'friend_delete_db', () => db.delete(friends).where(eq(friends.id, parseInt(id))));
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
