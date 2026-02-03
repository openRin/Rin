import { desc, eq } from "drizzle-orm";
import { t } from "elysia";
import { comments, feeds, users } from "../db/schema";
import base from "../base";
import { Config } from "../utils/config";
import { notify } from "../utils/webhook";


export const CommentService = base()
    .group('/feed/comment', (group) =>
        group
            .get('/:feed', async ({ params: { feed }, store: { db } }) => {
                const feedId = parseInt(feed);
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
            })
            .post('/:feed', async ({ uid, set, params: { feed }, body: { content }, store: { db, env, serverConfig } }) => {
                if (!uid) {
                    set.status = 401;
                    return 'Unauthorized';
                }
                if (!content) {
                    set.status = 400;
                    return 'Content is required';
                }
                const feedId = parseInt(feed);
                if (uid == undefined) {
                    return 'Invalid uid'
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
                // notify
                await notify(webhookUrl, `${env.FRONTEND_URL}/feed/${feedId}\n${user.username} 评论了: ${exist.title}\n${content}`);
                return 'OK';
            }, {
                body: t.Object({
                    content: t.String()
                })
            })
    )
    .group('/comment', (group) =>
        group
            .delete('/:id', async ({ uid, admin, set, params: { id }, store: { db } }) => {
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
                if (!admin && comment.userId !== uid) {
                    set.status = 403;
                    return 'Permission denied';
                }
                await db.delete(comments).where(eq(comments.id, id_num));
                return 'OK';
            })
    )
    ;