import { count, desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { startTime, endTime } from "hono/timing";
import { moments } from "../db/schema";
import type { AppContext } from "../core/hono-types";
import { momentCreateSchema, momentUpdateSchema } from "@rin/api";

export function MomentsService(): Hono {
    const app = new Hono();

    // GET /moments
    app.get('/', async (c: AppContext) => {
        startTime(c, 'moments-list');
        const db = c.get('db');
        const cache = c.get('cache');
        const page = c.req.query('page');
        const limit = c.req.query('limit');
        
        const page_num = (page ? parseInt(page) > 0 ? parseInt(page) : 1 : 1) - 1;
        const limit_num = limit ? parseInt(limit) > 50 ? 50 : parseInt(limit) : 20;
        const cacheKey = `moments_${page_num}_${limit_num}`;
        
        startTime(c, 'cache-get');
        const cached = await cache.get(cacheKey);
        endTime(c, 'cache-get');
        
        if (cached) {
            endTime(c, 'moments-list');
            return c.json(cached);
        }
        
        startTime(c, 'db-count');
        const size = await db.select({ count: count() }).from(moments);
        endTime(c, 'db-count');
        
        if (size[0].count === 0) {
            endTime(c, 'moments-list');
            return c.json({ size: 0, data: [], hasNext: false });
        }
        
        startTime(c, 'db-query');
        const moments_list = await db.query.moments.findMany({
            with: {
                user: { columns: { id: true, username: true, avatar: true } }
            },
            orderBy: [desc(moments.createdAt)],
            offset: page_num * limit_num,
            limit: limit_num + 1,
        });
        endTime(c, 'db-query');
        
        let hasNext = false;
        if (moments_list.length === limit_num + 1) {
            moments_list.pop();
            hasNext = true;
        }
        
        const data = { size: size[0].count, data: moments_list, hasNext };
        startTime(c, 'cache-set');
        await cache.set(cacheKey, data);
        endTime(c, 'cache-set');
        endTime(c, 'moments-list');
        return c.json(data);
    });

    // POST /moments
    app.post('/', async (c: AppContext) => {
        startTime(c, 'moments-create');
        const db = c.get('db');
        const cache = c.get('cache');
        const uid = c.get('uid');
        const admin = c.get('admin');
        const body = await c.req.json();
        const { content } = body;

        if (!uid) {
            endTime(c, 'moments-create');
            return c.text('Unauthorized', 401);
        }

        if (!admin) {
            endTime(c, 'moments-create');
            return c.text('Permission denied', 403);
        }

        if (!content) {
            endTime(c, 'moments-create');
            return c.text('Content is required', 400);
        }

        const date = new Date();
        startTime(c, 'db-insert');
        const result = await db.insert(moments).values({
            content, uid, createdAt: date, updatedAt: date
        }).returning({ insertedId: moments.id });
        endTime(c, 'db-insert');

        startTime(c, 'cache-clear');
        await cache.deletePrefix('moments_');
        endTime(c, 'cache-clear');

        endTime(c, 'moments-create');
        if (result.length === 0) {
            return c.text('Failed to insert', 500);
        } else {
            return c.json(result[0]);
        }
    });

    // POST /moments/:id
    app.post('/:id', async (c: AppContext) => {
        startTime(c, 'moments-update');
        const db = c.get('db');
        const cache = c.get('cache');
        const uid = c.get('uid');
        const admin = c.get('admin');
        const id = c.req.param('id');
        const body = await c.req.json();
        const { content } = body;

        if (!uid) {
            endTime(c, 'moments-update');
            return c.text('Unauthorized', 401);
        }

        if (!admin) {
            endTime(c, 'moments-update');
            return c.text('Permission denied', 403);
        }

        const id_num = parseInt(id);
        startTime(c, 'db-query');
        const moment = await db.query.moments.findFirst({ where: eq(moments.id, id_num) });
        endTime(c, 'db-query');

        if (!moment) {
            endTime(c, 'moments-update');
            return c.text('Not found', 404);
        }

        if (!content) {
            endTime(c, 'moments-update');
            return c.text('Content is required', 400);
        }

        startTime(c, 'db-update');
        await db.update(moments).set({
            content,
            updatedAt: new Date()
        }).where(eq(moments.id, id_num));
        endTime(c, 'db-update');

        startTime(c, 'cache-clear');
        await cache.deletePrefix('moments_');
        endTime(c, 'cache-clear');
        endTime(c, 'moments-update');
        return c.text('Updated');
    });

    // DELETE /moments/:id
    app.delete('/:id', async (c: AppContext) => {
        startTime(c, 'moments-delete');
        const db = c.get('db');
        const cache = c.get('cache');
        const uid = c.get('uid');
        const admin = c.get('admin');
        const id = c.req.param('id');

        if (!uid) {
            endTime(c, 'moments-delete');
            return c.text('Unauthorized', 401);
        }

        if (!admin) {
            endTime(c, 'moments-delete');
            return c.text('Permission denied', 403);
        }

        const id_num = parseInt(id);
        startTime(c, 'db-query');
        const moment = await db.query.moments.findFirst({ where: eq(moments.id, id_num) });
        endTime(c, 'db-query');

        if (!moment) {
            endTime(c, 'moments-delete');
            return c.text('Not found', 404);
        }

        startTime(c, 'db-delete');
        await db.delete(moments).where(eq(moments.id, id_num));
        endTime(c, 'db-delete');
        startTime(c, 'cache-clear');
        await cache.deletePrefix('moments_');
        endTime(c, 'cache-clear');
        endTime(c, 'moments-delete');
        return c.text('Deleted');
    });

    return app;
}
