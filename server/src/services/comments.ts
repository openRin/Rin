import { desc, eq } from "drizzle-orm";
import { comments, feeds, users } from "../db/schema";
import { Router } from "../core/router";
import type { Context } from "../core/types";
import { Config } from "../utils/config";
import { notify } from "../utils/webhook";
import { commentCreateSchema } from "@rin/api";

export function CommentService(router: Router): void {
    router.group('/comment', (group) => {
        group.get('/:feed', async (ctx: Context) => {
            const { params, store: { db } } = ctx;
            const feedId = parseInt(params.feed);
            
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
            
            return comment_list;
        });

        group.post('/:feed', async (ctx: Context) => {
            const { uid, set, params, body, store: { db, env, serverConfig } } = ctx;
            const { content } = body;
            
            if (!uid) {
                set.status = 401;
                return 'Unauthorized';
            }
            if (!content) {
                set.status = 400;
                return 'Content is required';
            }
            
            const feedId = parseInt(params.feed);
            if (uid == undefined) {
                return 'Invalid uid';
            }
            
            const user = await db.query.users.findFirst({ where: eq(users.id, uid) });
            if (!user) {
                set.status = 400;
                return 'User not found';
            }
            
            const exist = await db.query.feeds.findFirst({ where: eq(feeds.id, feedId) });
            if (!exist) {
                set.status = 400;
                return 'Feed not found';
            }

            await db.insert(comments).values({
                feedId,
                userId: uid,
                content
            });

            const webhookUrl = await serverConfig.get(Config.webhookUrl) || env.WEBHOOK_URL;
            const frontendUrl = ctx.url.origin;
            await notify(webhookUrl, `${frontendUrl}/feed/${feedId}\n${user.username} 评论了: ${exist.title}\n${content}`);
            return 'OK';
        }, commentCreateSchema);

        group.delete('/:id', async (ctx: Context) => {
            const { uid, admin, set, params, store: { db } } = ctx;
            
            if (uid === undefined) {
                set.status = 401;
                return 'Unauthorized';
            }
            
            const id_num = parseInt(params.id);
            const comment = await db.query.comments.findFirst({ where: eq(comments.id, id_num) });
            
            if (!comment) {
                set.status = 404;
                return 'Not found';
            }
            
            if (!admin && comment.userId !== uid) {
                set.status = 403;
                return 'Permission denied';
            }
            
            await db.delete(comments).where(eq(comments.id, id_num));
            return 'OK';
        });
    });
}
