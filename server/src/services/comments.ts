import { Hono } from "hono";
import { startTime, endTime } from "hono/timing";
import type { AppContext } from "../core/hono-types";
import { desc, eq } from "drizzle-orm";
import { comments, feeds, users } from "../db/schema";
import { Config } from "../utils/config";
import { notify } from "../utils/webhook";

export function CommentService(): Hono {
    const app = new Hono();

    app.get('/:feed', async (c: AppContext) => {
        startTime(c, 'comment-list');
        const db = c.get('db');
        const feedId = parseInt(c.req.param('feed'));
        
        startTime(c, 'db-query');
        const comment_list = await db.query.comments.findMany({
            where: eq(comments.feedId, feedId),
            columns: { feedId: false, userId: false },
            with: {
                user: {
                    columns: { id: true, username: true, avatar: true, permission: true }
                }
            },
            orderBy: [desc(comments.createdAt)]
        });
        endTime(c, 'db-query');
        
        endTime(c, 'comment-list');
        return c.json(comment_list);
    });

    app.post('/:feed', async (c: AppContext) => {
        startTime(c, 'comment-create');
        const db = c.get('db');
        const env = c.get('env');
        const serverConfig = c.get('serverConfig');
        const uid = c.get('uid');
        const feedId = parseInt(c.req.param('feed'));
        const body = await c.req.json();
        const { content } = body;
        
        if (!uid) {
            endTime(c, 'comment-create');
            return c.text('Unauthorized', 401);
        }
        if (!content) {
            endTime(c, 'comment-create');
            return c.text('Content is required', 400);
        }
        
        if (uid == undefined) {
            endTime(c, 'comment-create');
            return c.text('Invalid uid', 400);
        }
        
        startTime(c, 'db-user-query');
        const user = await db.query.users.findFirst({ where: eq(users.id, uid) });
        endTime(c, 'db-user-query');
        if (!user) {
            endTime(c, 'comment-create');
            return c.text('User not found', 400);
        }
        
        startTime(c, 'db-feed-query');
        const exist = await db.query.feeds.findFirst({ where: eq(feeds.id, feedId) });
        endTime(c, 'db-feed-query');
        if (!exist) {
            endTime(c, 'comment-create');
            return c.text('Feed not found', 400);
        }

        startTime(c, 'db-insert');
        await db.insert(comments).values({
            feedId,
            userId: uid,
            content
        });
        endTime(c, 'db-insert');

        startTime(c, 'config-get');
        const webhookUrl = await serverConfig.get(Config.webhookUrl) || env.WEBHOOK_URL;
        endTime(c, 'config-get');
        const frontendUrl = new URL(c.req.url).origin;
        startTime(c, 'webhook-notify');
        await notify(webhookUrl, `${frontendUrl}/feed/${feedId}\n${user.username} 评论了: ${exist.title}\n${content}`);
        endTime(c, 'webhook-notify');
        endTime(c, 'comment-create');
        return c.text('OK');
    });

    app.delete('/:id', async (c: AppContext) => {
        startTime(c, 'comment-delete');
        const db = c.get('db');
        const uid = c.get('uid');
        const admin = c.get('admin');
        
        if (uid === undefined) {
            endTime(c, 'comment-delete');
            return c.text('Unauthorized', 401);
        }
        
        const id_num = parseInt(c.req.param('id'));
        startTime(c, 'db-query');
        const comment = await db.query.comments.findFirst({ where: eq(comments.id, id_num) });
        endTime(c, 'db-query');
        
        if (!comment) {
            endTime(c, 'comment-delete');
            return c.text('Not found', 404);
        }
        
        if (!admin && comment.userId !== uid) {
            endTime(c, 'comment-delete');
            return c.text('Permission denied', 403);
        }
        
        startTime(c, 'db-delete');
        await db.delete(comments).where(eq(comments.id, id_num));
        endTime(c, 'db-delete');
        endTime(c, 'comment-delete');
        return c.text('OK');
    });

    return app;
}
