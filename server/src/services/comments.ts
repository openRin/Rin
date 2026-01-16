import { desc, eq } from "drizzle-orm";
import Elysia, { t } from "elysia";
import type { DB } from "../_worker";
import type { Env } from "../db/db";
import { comments, feeds, users } from "../db/schema";
import { setup } from "../setup";
import { ServerConfig } from "../utils/cache";
import { Config } from "../utils/config";
import { getDB, getEnv } from "../utils/di";
import { notify } from "../utils/webhook";

export function CommentService() {
    const db: DB = getDB();
    const env: Env = getEnv();
    return new Elysia({ aot: false })
        .use(setup())
        .group('/feed/comment', (group) =>
            group
                .get('/:feed', async ({ params: { feed } }) => {
                    const feedId = parseInt(feed);
                    const allComments = await db.query.comments.findMany({
                        where: eq(comments.feedId, feedId),
                        columns: { feedId: false, userId: false },
                        with: {
                            user: {
                                columns: { id: true, username: true, avatar: true, permission: true }
                            },
                            replyToUser: {
                                columns: { id: true, username: true }
                            }
                        },
                        orderBy: [desc(comments.createdAt)]
                    });

                    // Build nested structure
                    const rootComments: any[] = [];
                    const replyMap = new Map();

                    // First, collect all replies by parent ID
                    for (const comment of allComments) {
                        if (comment.parentId) {
                            if (!replyMap.has(comment.parentId)) {
                                replyMap.set(comment.parentId, []);
                            }
                            replyMap.get(comment.parentId).push(comment);
                        } else {
                            rootComments.push(comment);
                        }
                    }

                    // Attach replies to their parents and sort by createdAt ascending (older first)
                    for (const root of rootComments) {
                        const replies = replyMap.get(root.id) || [];
                        // Sort replies by createdAt ascending (older first)
                        replies.sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
                        (root as any).replies = replies;
                    }

                    return rootComments;
                })
                .post('/:feed', async ({ uid, set, params: { feed }, body: { content, parentId, replyToUserId } }) => {
                    if (!uid) {
                        set.status = 401;
                        return 'Unauthorized';
                    }
                    if (!content) {
                        set.status = 400;
                        return 'Content is required';
                    }
                    const feedId = parseInt(feed);
                    const userId = parseInt(uid);
                    const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
                    if (!user) {
                        set.status = 400;
                        return 'User not found';
                    }
                    const exist = await db.query.feeds.findFirst({ where: eq(feeds.id, feedId) });
                    if (!exist) {
                        set.status = 400;
                        return 'Feed not found';
                    }
                    let finalParentId = parentId || null;
                    let finalReplyToUserId = replyToUserId ? parseInt(replyToUserId as string) : null;

                    if (parentId) {
                        const parentComment = await db.query.comments.findFirst({ where: eq(comments.id, parentId) });
                        if (!parentComment || parentComment.feedId !== feedId) {
                            set.status = 400;
                            return 'Parent comment not found';
                        }
                        // Enforce two-level nesting: if parent is already a reply, use its parent (root comment)
                        if (parentComment.parentId) {
                            finalParentId = parentComment.parentId;
                            // If replying to a reply, use the reply's author as replyToUser
                            if (!finalReplyToUserId) {
                                finalReplyToUserId = parentComment.userId;
                            }
                        } else if (!finalReplyToUserId) {
                            // If replying to a root comment without explicit replyToUser, use the root comment's author
                            finalReplyToUserId = parentComment.userId;
                        }
                    }

                    await db.insert(comments).values({
                        feedId,
                        userId,
                        content,
                        parentId: finalParentId,
                        replyToUserId: finalReplyToUserId
                    });

                    const webhookUrl = await ServerConfig().get(Config.webhookUrl) || env.WEBHOOK_URL;
                    // notify
                    await notify(webhookUrl, `${env.FRONTEND_URL}/feed/${feedId}\n${user.username} ${parentId ? '回复了评论' : '评论了'}: ${exist.title}\n${content}`);
                    return 'OK';
                }, {
                    body: t.Object({
                        content: t.String(),
                        parentId: t.Optional(t.Union([t.String(), t.Number()])),
                        replyToUserId: t.Optional(t.Union([t.String(), t.Number()]))
                    })
                })
        )
        .group('/comment', (group) =>
            group
                .delete('/:id', async ({ uid, admin, set, params: { id } }) => {
                    if (uid === undefined) {
                        set.status = 401;
                        return 'Unauthorized';
                    }
                    const id_num = parseInt(id);
                    const comment = await db.query.comments.findFirst({ where: eq(comments.id, id_num) });
                    if (!comment) {
                        set.status = 404;
                        return 'Not found';
                    }
                    if (!admin && comment.userId !== parseInt(uid)) {
                        set.status = 403;
                        return 'Permission denied';
                    }
                    await db.delete(comments).where(eq(comments.id, id_num));
                    return 'OK';
                })
        );
}