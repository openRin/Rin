import { Hono } from "hono";
import type { AppContext } from "../core/hono-types";
import { desc, eq } from "drizzle-orm";
import { comments, feeds, users } from "../db/schema";
import { profileAsync } from "../core/server-timing";
import { notify } from "../utils/webhook";
import { resolveWebhookConfig } from "./config-helpers";

export function CommentService(): Hono {
    const app = new Hono();

    app.get('/:feed', async (c: AppContext) => {
        const db = c.get('db');
        const feedId = parseInt(c.req.param('feed'));
        
        const comment_list = await profileAsync(c, 'comment_list_db', () => db.query.comments.findMany({
            where: eq(comments.feedId, feedId),
            columns: { feedId: false, userId: false },
            with: {
                user: {
                    columns: { id: true, username: true, avatar: true, permission: true }
                }
            },
            orderBy: [desc(comments.createdAt)]
        }));
        
        // 将结果统一为前端兼容格式：登录用户用 user 字段，游客用 guestName 等
        const result = comment_list.map((c: any) => {
            if (c.user) {
                // 登录用户的评论
                return c;
            }
            // 游客评论：去掉空的 user 字段，保留 guestName 等
            const { user, ...rest } = c;
            return {
                ...rest,
                user: null,
                guestName: rest.guestName || "",
                guestEmail: rest.guestEmail || "",
                guestWebsite: rest.guestWebsite || "",
            };
        });
        
        return c.json(result);
    });

    app.post('/:feed', async (c: AppContext) => {
        const db = c.get('db');
        const env = c.get('env');
        const serverConfig = c.get('serverConfig');
        const uid = c.get('uid');
        const feedId = parseInt(c.req.param('feed'));
        const body = await profileAsync(c, 'comment_create_parse', () => c.req.json());
        const { content, guestName, guestEmail, guestWebsite } = body;
        
        if (!content) {
            return c.text('Content is required', 400);
        }
        
        const exist = await profileAsync(c, 'comment_create_feed', () => db.query.feeds.findFirst({ where: eq(feeds.id, feedId) }));
        if (!exist) {
            return c.text('Feed not found', 400);
        }

        // 登录用户评论
        if (uid) {
            const user = await profileAsync(c, 'comment_create_user', () => db.query.users.findFirst({ where: eq(users.id, uid) }));
            if (!user) {
                return c.text('User not found', 400);
            }

            await db.insert(comments).values({
                feedId,
                userId: uid,
                content
            });

            const { webhookUrl, webhookMethod, webhookContentType, webhookHeaders, webhookBodyTemplate } =
                await profileAsync(c, 'comment_create_webhook_config', () => resolveWebhookConfig(serverConfig, env));
            const frontendUrl = new URL(c.req.url).origin;
            try {
                await profileAsync(c, 'comment_create_notify', () => notify(
                    webhookUrl || "",
                    {
                        event: "comment.created",
                        message: `${frontendUrl}/feed/${feedId}\n${user.username} 评论了: ${exist.title}\n${content}`,
                        title: exist.title || "",
                        url: `${frontendUrl}/feed/${feedId}`,
                        username: user.username,
                        content,
                    },
                    {
                        method: webhookMethod,
                        contentType: webhookContentType,
                        headers: webhookHeaders,
                        bodyTemplate: webhookBodyTemplate,
                    },
                ));
            } catch (error) {
                console.error("Failed to send comment webhook", error);
            }
            return c.text('OK');
        }

        // 游客评论
        if (!guestName || !guestName.trim()) {
            return c.text('Guest name is required', 400);
        }

        await db.insert(comments).values({
            feedId,
            userId: null,
            content,
            guestName: guestName.trim(),
            guestEmail: guestEmail?.trim() || "",
            guestWebsite: guestWebsite?.trim() || "",
            approved: 1,
        });

        const { webhookUrl, webhookMethod, webhookContentType, webhookHeaders, webhookBodyTemplate } =
            await profileAsync(c, 'comment_create_webhook_config', () => resolveWebhookConfig(serverConfig, env));
        const frontendUrl = new URL(c.req.url).origin;
        try {
            await profileAsync(c, 'comment_create_notify', () => notify(
                webhookUrl || "",
                {
                    event: "comment.created",
                    message: `${frontendUrl}/feed/${feedId}\n游客 ${guestName} 评论了: ${exist.title}\n${content}`,
                    title: exist.title || "",
                    url: `${frontendUrl}/feed/${feedId}`,
                    username: guestName,
                    content,
                },
                {
                    method: webhookMethod,
                    contentType: webhookContentType,
                    headers: webhookHeaders,
                    bodyTemplate: webhookBodyTemplate,
                },
            ));
        } catch (error) {
            console.error("Failed to send comment webhook", error);
        }
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
        const comment = await profileAsync(c, 'comment_delete_lookup', () => db.query.comments.findFirst({ where: eq(comments.id, id_num) }));
        
        if (!comment) {
            return c.text('Not found', 404);
        }
        
        // 管理员可删任意评论；普通用户只能删自己的
        if (admin) {
            await db.delete(comments).where(eq(comments.id, id_num));
            return c.text('OK');
        }
        
        if (comment.userId !== uid) {
            return c.text('Permission denied', 403);
        }
        
        await db.delete(comments).where(eq(comments.id, id_num));
        return c.text('OK');
    });

    return app;
}
