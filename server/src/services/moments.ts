import { count, desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { moments } from "../db/schema";
import type { AppContext } from "../core/hono-types";
import { profileAsync } from "../core/server-timing";
import { momentCreateSchema, momentUpdateSchema } from "@rin/api";

export function MomentsService(): Hono {
    const app = new Hono();

    // GET /moments
    app.get('/', async (c: AppContext) => {
        const db = c.get('db');
        const cache = c.get('cache');
        const page = c.req.query('page');
        const limit = c.req.query('limit');
        
        const page_num = (page ? parseInt(page) > 0 ? parseInt(page) : 1 : 1) - 1;
        const limit_num = limit ? parseInt(limit) > 50 ? 50 : parseInt(limit) : 20;
        const cacheKey = `moments_${page_num}_${limit_num}`;
        const cached = await profileAsync(c, 'moments_list_cache_get', () => cache.get(cacheKey));
        
        if (cached) {
            return c.json(cached);
        }
        
        const size = await profileAsync(c, 'moments_list_count', () => db.select({ count: count() }).from(moments));
        
        if (size[0].count === 0) {
            return c.json({ size: 0, data: [], hasNext: false });
        }
        
        const moments_list = await profileAsync(c, 'moments_list_db', () => db.query.moments.findMany({
            with: {
                user: { columns: { id: true, username: true, avatar: true } }
            },
            orderBy: [desc(moments.createdAt)],
            offset: page_num * limit_num,
            limit: limit_num + 1,
        }));
        
        let hasNext = false;
        if (moments_list.length === limit_num + 1) {
            moments_list.pop();
            hasNext = true;
        }
        
        const data = { size: size[0].count, data: moments_list, hasNext };
        await profileAsync(c, 'moments_list_cache_set', () => cache.set(cacheKey, data));
        return c.json(data);
    });

    // POST /moments
    app.post('/', async (c: AppContext) => {
        const db = c.get('db');
        const cache = c.get('cache');
        const uid = c.get('uid');
        const admin = c.get('admin');
        const body = await profileAsync(c, 'moments_create_parse', () => c.req.json());
        const { content } = body;
        
        if (!uid) {
            return c.text('Unauthorized', 401);
        }
        
        if (!admin) {
            return c.text('Permission denied', 403);
        }
        
        if (!content) {
            return c.text('Content is required', 400);
        }
        
        const date = new Date();
        const result = await profileAsync(c, 'moments_create_insert', () => db.insert(moments).values({
            content, uid, createdAt: date, updatedAt: date
        }).returning({ insertedId: moments.id }));
        
        await profileAsync(c, 'moments_create_cache_invalidate', () => cache.deletePrefix('moments_'));
        
        if (result.length === 0) {
            return c.text('Failed to insert', 500);
        } else {
            return c.json(result[0]);
        }
    });

    // POST /moments/:id
    app.post('/:id', async (c: AppContext) => {
        const db = c.get('db');
        const cache = c.get('cache');
        const uid = c.get('uid');
        const admin = c.get('admin');
        const id = c.req.param('id');
        const body = await profileAsync(c, 'moments_update_parse', () => c.req.json());
        const { content } = body;
        
        if (!uid) {
            return c.text('Unauthorized', 401);
        }
        
        if (!admin) {
            return c.text('Permission denied', 403);
        }
        
        const id_num = parseInt(id);
        const moment = await profileAsync(c, 'moments_update_lookup', () => db.query.moments.findFirst({ where: eq(moments.id, id_num) }));
        
        if (!moment) {
            return c.text('Not found', 404);
        }
        
        if (!content) {
            return c.text('Content is required', 400);
        }
        
        await profileAsync(c, 'moments_update_db', () => db.update(moments).set({
            content,
            updatedAt: new Date()
        }).where(eq(moments.id, id_num)));
        
        await profileAsync(c, 'moments_update_cache_invalidate', () => cache.deletePrefix('moments_'));
        return c.text('Updated');
    });

    // DELETE /moments/:id
    app.delete('/:id', async (c: AppContext) => {
        const db = c.get('db');
        const cache = c.get('cache');
        const uid = c.get('uid');
        const admin = c.get('admin');
        const id = c.req.param('id');
        
        if (!uid) {
            return c.text('Unauthorized', 401);
        }
        
        if (!admin) {
            return c.text('Permission denied', 403);
        }
        
        const id_num = parseInt(id);
        const moment = await profileAsync(c, 'moments_delete_lookup', () => db.query.moments.findFirst({ where: eq(moments.id, id_num) }));
        
        if (!moment) {
            return c.text('Not found', 404);
        }
        
        await profileAsync(c, 'moments_delete_db', () => db.delete(moments).where(eq(moments.id, id_num)));
        await profileAsync(c, 'moments_delete_cache_invalidate', () => cache.deletePrefix('moments_'));
        return c.text('Deleted');
    });

    return app;
}
