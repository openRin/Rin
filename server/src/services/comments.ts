import { Hono } from "hono";
import type { AppContext } from "../core/hono-types";
import { desc, eq } from "drizzle-orm";
import { comments, feeds, users } from "../db/schema";
import { Config } from "../utils/config";
import { notify } from "../utils/webhook";

export function CommentService(): Hono {
    const app = new Hono();

    app.get('/:feed', async (c: AppContext) => {
        const db = c.get('db');
        const feedId = parseInt(c.req.param('feed'));
        
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
        
        return c.json(comment_list);
    });

    app.post('/:feed', async (c: AppContext) => {
        const db = c.get('db');
        const env = c.get('env');
        const serverConfig = c.get('serverConfig');
        const uid = c.get('uid');
        const feedId = parseInt(c.req.param('feed'));
        const body = await c.req.json();
        const { content } = body;
        
        if (!uid) {
            return c.text('Unauthorized', 401);
        }
        if (!content) {
            return c.text('Content is required', 400);
        }
        
        if (uid == undefined) {
            return c.text('Invalid uid', 400);
        }
        
        const user = await db.query.users.findFirst({ where: eq(users.id, uid) });
        if (!user) {
            return c.text('User not found', 400);
        }
        
        const exist = await db.query.feeds.findFirst({ where: eq(feeds.id, feedId) });
        if (!exist) {
            return c.text('Feed not found', 400);
        }

        await db.insert(comments).values({
            feedId,
            userId: uid,
            content
        });

        const webhookUrl = await serverConfig.get(Config.webhookUrl) || env.WEBHOOK_URL;
        const frontendUrl = new URL(c.req.url).origin;
        await notify(webhookUrl, `${frontendUrl}/feed/${feedId}\n${user.username} 评论了: ${exist.title}\n${content}`);
        return c.text('OK');
    });

    app.delete('/:id', async (c: AppContext) => {
        const db = c.get('db');
        const uid = c.get('uid');
        const admin = c.get('admin');
        
        if (uid === undefined) {
            return c.text('Unauthorized', 401);
        }
        
        const id_num = parseInt(c.req.param('id'));
        const comment = await db.query.comments.findFirst({ where: eq(comments.id, id_num) });
        
        if (!comment) {
            return c.text('Not found', 404);
        }
        
        if (!admin && comment.userId !== uid) {
            return c.text('Permission denied', 403);
        }
        
        await db.delete(comments).where(eq(comments.id, id_num));
        return c.text('OK');
    });

    return app;
}
