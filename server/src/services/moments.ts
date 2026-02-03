import { count, desc, eq } from "drizzle-orm";
import { moments } from "../db/schema";
import { Router } from "../core/router";
import { t } from "../core/index";
import type { Context } from "../core/types";

export function MomentsService(router: Router): void {
    router.group('/moments', (group) => {
        // GET /moments
        group.get('/', async (ctx: Context) => {
            const { query, store: { db, cache } } = ctx;
            const { page, limit } = query;
            
            const page_num = (page ? page > 0 ? page : 1 : 1) - 1;
            const limit_num = limit ? +limit > 50 ? 50 : +limit : 20;
            const cacheKey = `moments_${page_num}_${limit_num}`;
            const cached = await cache.get(cacheKey);
            
            if (cached) {
                return cached;
            }
            
            const size = await db.select({ count: count() }).from(moments);
            
            if (size[0].count === 0) {
                return { size: 0, data: [], hasNext: false };
            }
            
            const moments_list = await db.query.moments.findMany({
                with: {
                    user: { columns: { id: true, username: true, avatar: true } }
                },
                orderBy: [desc(moments.createdAt)],
                offset: page_num * limit_num,
                limit: limit_num + 1,
            });
            
            let hasNext = false;
            if (moments_list.length === limit_num + 1) {
                moments_list.pop();
                hasNext = true;
            }
            
            const data = { size: size[0].count, data: moments_list, hasNext };
            await cache.set(cacheKey, data);
            return data;
        }, {
            type: 'object',
            properties: {
                page: { type: 'number', optional: true },
                limit: { type: 'number', optional: true }
            }
        });

        // POST /moments
        group.post('/', async (ctx: Context) => {
            const { set, admin, uid, body, store: { db, cache } } = ctx;
            const { content } = body;
            
            if (!uid) {
                set.status = 401;
                return 'Unauthorized';
            }
            
            if (!admin) {
                set.status = 403;
                return 'Permission denied';
            }
            
            if (!content) {
                set.status = 400;
                return 'Content is required';
            }
            
            const date = new Date();
            const result = await db.insert(moments).values({
                content, uid, createdAt: date, updatedAt: date
            }).returning({ insertedId: moments.id });
            
            await cache.deletePrefix('moments_');
            
            if (result.length === 0) {
                set.status = 500;
                return 'Failed to insert';
            } else {
                return result[0];
            }
        }, {
            type: 'object',
            properties: {
                content: { type: 'string' }
            }
        });

        // POST /moments/:id
        group.post('/:id', async (ctx: Context) => {
            const { uid, admin, set, params, body, store: { db, cache } } = ctx;
            const { content } = body;
            
            if (!uid) {
                set.status = 401;
                return 'Unauthorized';
            }
            
            if (!admin) {
                set.status = 403;
                return 'Permission denied';
            }
            
            const id_num = parseInt(params.id);
            const moment = await db.query.moments.findFirst({ where: eq(moments.id, id_num) });
            
            if (!moment) {
                set.status = 404;
                return 'Not found';
            }
            
            if (!content) {
                set.status = 400;
                return 'Content is required';
            }
            
            await db.update(moments).set({
                content,
                updatedAt: new Date()
            }).where(eq(moments.id, id_num));
            
            await cache.deletePrefix('moments_');
            return 'Updated';
        }, {
            type: 'object',
            properties: {
                content: { type: 'string' }
            }
        });

        // DELETE /moments/:id
        group.delete('/:id', async (ctx: Context) => {
            const { uid, admin, set, params, store: { db, cache } } = ctx;
            
            if (!uid) {
                set.status = 401;
                return 'Unauthorized';
            }
            
            if (!admin) {
                set.status = 403;
                return 'Permission denied';
            }
            
            const id_num = parseInt(params.id);
            const moment = await db.query.moments.findFirst({ where: eq(moments.id, id_num) });
            
            if (!moment) {
                set.status = 404;
                return 'Not found';
            }
            
            await db.delete(moments).where(eq(moments.id, id_num));
            await cache.deletePrefix('moments_');
            return 'Deleted';
        });
    });
}
