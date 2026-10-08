import { Hono } from "hono";
import {
  COMMENT_ERROR_CODES,
  commentCreateSchema,
  commentModerationSchema,
  validateSchema,
  type CreateCommentRequest,
  type CreateCommentResponse,
} from "@rin/api";
import { and, count, desc, eq } from "drizzle-orm";
import type { AppContext } from "../core/hono-types";
import { adminOnly } from "../core/route-boundaries";
import { profileAsync } from "../core/server-timing";
import { comments, feeds, users } from "../db/schema";
import { bizError, validationErrorFromIssues } from "../errors";
import { notify } from "../utils/webhook";
import { resolveWebhookConfig } from "./config-helpers";
import { buildCaptchaPublicConfig, verifyCaptchaToken } from "./captcha";
import { createPluginContext, pluginRegistry } from "../plugins/registry";

/**
 * 评论服务。关键约定：公开列表只返回 approved=1（审核真实生效）；
 * 请求体用 @rin/api 的共享 schema 校验；业务失败抛 bizError，前端按 code 映射 i18n。
 */

/** 游客评论是否默认进入待审核队列（登录用户始终直接可见） */
const GUEST_COMMENT_NEEDS_APPROVAL_DEFAULT = true;

/**
 * 登录用户的评论默认也要审核：开了人机验证说明有人在刷，
 * 登录只证明"是真实账号"，不代表评论可信。想放行设 comment.moderate_user=false。
 */
const USER_COMMENT_NEEDS_APPROVAL_DEFAULT = true;

/** 同一篇文章下游客评论的频率上限（每分钟） */
const GUEST_COMMENT_RATE_LIMIT = 5;

export function CommentService(): Hono {
    const app = new Hono();

    /** 审核策略：登录用户由 comment.moderate_user 决定；guest.enabled 只是前端展示开关 */
    async function shouldApproveGuestComment(c: AppContext): Promise<boolean> {
        const serverConfig = c.get('serverConfig');
        const value = await serverConfig.getOrDefault<boolean>(
            "comment.moderate_guest",
            GUEST_COMMENT_NEEDS_APPROVAL_DEFAULT,
        );
        return value !== false;
    }

    /** 登录用户的评论是否也需要审核，默认需要（见 USER_COMMENT_NEEDS_APPROVAL_DEFAULT） */
    async function shouldApproveUserComment(c: AppContext): Promise<boolean> {
        const serverConfig = c.get('serverConfig');
        const value = await serverConfig.getOrDefault<boolean>(
            "comment.moderate_user",
            USER_COMMENT_NEEDS_APPROVAL_DEFAULT,
        );
        return value !== false;
    }

    // GET /comment/captcha - 下发前端渲染 Turnstile 所需的公开配置
    // 必须注册在 `/:feed` 之前，否则 "captcha" 会被当成 feedId 解析。
    app.get('/captcha', async (c: AppContext) => {
        const serverConfig = c.get('serverConfig');
        const env = c.get('env');

        const captchaConfig = await profileAsync(c, 'comment_captcha_config', () =>
            buildCaptchaPublicConfig(serverConfig, env),
        );

        // 只回传公开字段，secretKey 永不离开服务端
        return c.json(captchaConfig);
    });

    // GET /comment/pending - 待审核评论队列（仅管理员）
    // 同样必须先于 `/:feed` 注册。
    // GET /comment/pending?filter=pending|approved|all&page=1
    // filter 用于后台「评论管理」切换不同状态；不传时只看待审（保持原行为）
    app.get('/pending', adminOnly(async (c: AppContext) => {
        const db = c.get('db');

        const filter = c.req.query('filter') ?? 'pending';
        const page = Math.max(1, Number(c.req.query('page')) || 1);
        const size = Math.min(100, Math.max(1, Number(c.req.query('size')) || 20));
        const offset = (page - 1) * size;

        // 只接受已知取值，其他一律按 pending 处理，避免拼错参数时把全部数据暴露出去
        const where = filter === 'all'
            ? undefined
            : filter === 'approved'
                ? eq(comments.approved, 1)
                : eq(comments.approved, 0);

        const [rows, totalResult] = await profileAsync(c, 'comment_pending_db', () =>
            Promise.all([
                db.query.comments.findMany({
                    where,
                    with: {
                        feed: { columns: { id: true, title: true } },
                        // 必须带上 user，否则后台看不到作者
                        user: {
                            columns: { id: true, username: true, avatar: true, permission: true },
                        },
                    },
                    orderBy: [desc(comments.createdAt)],
                    limit: size,
                    offset,
                }),
                db.select({ value: count() }).from(comments).where(where),
            ]),
        );

        const total = totalResult[0]?.value ?? 0;

        return c.json({
            comments: rows.map((row: any) => ({
                ...row,
                approved: row.approved === 1,
                feedId: row.feed?.id ?? row.feedId,
                feedTitle: row.feed?.title ?? null,
            })),
            pagination: {
                page,
                size,
                total,
                totalPages: Math.max(1, Math.ceil(total / size)),
            },
        });
    }, { format: 'json' }));

    app.get('/:feed', async (c: AppContext) => {
        const db = c.get('db');
        const admin = c.get('admin');
        const feedId = c.req.param('feed');

        if (!feedId) {
            throw bizError(COMMENT_ERROR_CODES.COMMENT_FEED_NOT_FOUND, 'Feed not found', 404);
        }

        const conditions = [eq(comments.feedId, feedId)];
        // 管理员可以看到未过审的评论（用于预览），普通访客只看到已过审的。
        if (!admin) {
            conditions.push(eq(comments.approved, 1));
        }

        const comment_list = await profileAsync(c, 'comment_list_db', () => db.query.comments.findMany({
            where: and(...conditions),
            columns: { feedId: false, userId: false },
            with: {
                user: {
                    columns: { id: true, username: true, avatar: true, permission: true }
                }
            },
            orderBy: [desc(comments.createdAt)]
        }));

        // 将结果统一为前端兼容格式：登录用户用 user 字段，游客用 guestName 等
        const result = comment_list.map((row: any) => {
            if (row.user) {
                return { ...row, approved: row.approved === 1 };
            }

            const { user, ...rest } = row;
            return {
                ...rest,
                user: null,
                approved: rest.approved === 1,
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
        const cache = c.get('cache');
        const uid = c.get('uid');
        const feedId = c.req.param('feed');

        if (!feedId) {
            throw bizError(COMMENT_ERROR_CODES.COMMENT_FEED_NOT_FOUND, 'Feed not found', 404);
        }

        // 契约校验：schema 来自 @rin/api，服务端不再手写 content 非空判断
        const body = await profileAsync(c, 'comment_create_parse', () => c.req.json()) as CreateCommentRequest;
        const validation = validateSchema<CreateCommentRequest>(commentCreateSchema, body);

        if (!validation.success) {
            const contentIssue = validation.issues.find((issue) => issue.path === 'content');
            const code = !contentIssue
                ? COMMENT_ERROR_CODES.COMMENT_VALIDATION_FAILED
                : contentIssue.message.includes('at most')
                    ? COMMENT_ERROR_CODES.COMMENT_CONTENT_TOO_LONG
                    : COMMENT_ERROR_CODES.COMMENT_CONTENT_REQUIRED;

            throw validationErrorFromIssues(code, 'Comment validation failed', validation.issues);
        }

        const { content, guestName, guestEmail, guestWebsite, captchaToken } = validation.data;
        const trimmedContent = content.trim();

        if (!trimmedContent) {
            throw bizError(COMMENT_ERROR_CODES.COMMENT_CONTENT_REQUIRED, 'Content is required', 400);
        }

        const exist = await profileAsync(c, 'comment_create_feed', () =>
            db.query.feeds.findFirst({ where: eq(feeds.id, feedId) }),
        );
        if (!exist) {
            throw bizError(COMMENT_ERROR_CODES.COMMENT_FEED_NOT_FOUND, 'Feed not found', 404);
        }

        // 人机验证在写库之前完成，失败不留脏数据
        await profileAsync(c, 'comment_create_captcha', () => verifyCaptchaToken({
            serverConfig,
            env,
            isLoggedIn: Boolean(uid),
            captchaToken,
            expectedAction: 'comment',
        }));

        // 插件扩展点：评论提交前钩子。
        // 放在人机验证之后、写库之前 —— 既不浪费验证额度，也不会留下脏数据。
        // 插件返回非空字符串表示拒绝本次提交。
        const pluginCtx = createPluginContext({
            pluginName: 'comment',
            db,
            cache,
            serverConfig,
            clientConfig: c.get('clientConfig'),
            env,
            request: c,
        });

        const rejection = await profileAsync(c, 'comment_create_plugins', () =>
            pluginRegistry.beforeCommentCreate({
                feedId,
                content: trimmedContent,
                userId: uid ?? null,
                guestName,
                guestEmail,
                guestWebsite,
                isLoggedIn: Boolean(uid),
                isAdmin: c.get('admin'),
            }, pluginCtx),
        );

        if (typeof rejection === 'string' && rejection.length > 0) {
            throw bizError(
                COMMENT_ERROR_CODES.COMMENT_VALIDATION_FAILED,
                rejection,
                400,
            );
        }

        let insertedId: number;
        let approved: 1 | 0;
        let authorName: string;

        if (uid) {
            // 登录用户：是否需要审核取决于 comment.moderate_user（默认要）
            const user = await profileAsync(c, 'comment_create_user', () =>
                db.query.users.findFirst({ where: eq(users.id, uid) }),
            );
            if (!user) {
                throw bizError(COMMENT_ERROR_CODES.LOGIN_REQUIRED, 'User not found', 401);
            }

            approved = (await shouldApproveUserComment(c)) ? 0 : 1;
            authorName = user.username;

            const inserted = await profileAsync(c, 'comment_create_insert', () =>
                db.insert(comments).values({
                    feedId,
                    userId: uid,
                    content: trimmedContent,
                    approved,
                }).returning({ id: comments.id }),
            );
            insertedId = inserted[0].id;
        } else {
            // 游客：昵称必填，且受服务端开关控制
            const trimmedGuestName = guestName?.trim();
            if (!trimmedGuestName) {
                throw bizError(
                    COMMENT_ERROR_CODES.COMMENT_GUEST_NAME_REQUIRED,
                    'Guest name is required',
                    400,
                );
            }

            // 服务端强制校验该开关，直接调 API 也绕不过去
            const clientConfig = c.get('clientConfig');
            const guestEnabled = await profileAsync(c, 'comment_create_guest_enabled', () =>
                clientConfig.getOrDefault<boolean>("comment.guest.enabled", true),
            );
            if (guestEnabled === false) {
                throw bizError(
                    COMMENT_ERROR_CODES.COMMENT_GUEST_DISABLED,
                    'Guest comments are disabled, please sign in first',
                    403,
                );
            }

            // 写库前的频率限制。这不能替代验证码：验证码挡机器，频率限制挡洪水。
            const rate = await applyGuestRateLimit(c, feedId);
            if (!rate.allowed) {
                throw bizError(
                    COMMENT_ERROR_CODES.RATE_LIMITED,
                    'Too many comments, please slow down',
                    429,
                );
            }

            approved = (await shouldApproveGuestComment(c)) ? 0 : 1;
            authorName = trimmedGuestName;

            const inserted = await profileAsync(c, 'comment_create_insert', () =>
                db.insert(comments).values({
                    feedId,
                    userId: null,
                    content: trimmedContent,
                    guestName: trimmedGuestName,
                    guestEmail: guestEmail?.trim() || "",
                    guestWebsite: guestWebsite?.trim() || "",
                    approved,
                }).returning({ id: comments.id }),
            );
            insertedId = inserted[0].id;
        }

        // 插件扩展点：评论创建后钩子。评论已落库，插件抛错也不会回滚（registry 内部吞异常）
        await profileAsync(c, 'comment_create_plugins_after', () =>
            pluginRegistry.afterCommentCreate({
                id: insertedId,
                feedId,
                userId: uid ?? null,
                content: trimmedContent,
                authorName,
                approved: approved === 1,
            }, pluginCtx),
        );

        // Webhook 只在评论真正可见时通知：待审核评论发出去会误导站长的通知渠道。
        if (approved === 1) {
            const { webhookUrl, webhookMethod, webhookContentType, webhookHeaders, webhookBodyTemplate } =
                await profileAsync(c, 'comment_create_webhook_config', () => resolveWebhookConfig(serverConfig, env));
            const frontendUrl = new URL(c.req.url).origin;
            const isGuest = !uid;
            try {
                await profileAsync(c, 'comment_create_notify', () => notify(
                    webhookUrl || "",
                    {
                        event: "comment.created",
                        message: `${frontendUrl}/feed/${feedId}\n${isGuest ? `游客 ${authorName}` : authorName} 评论了: ${exist.title}\n${trimmedContent}`,
                        title: exist.title || "",
                        url: `${frontendUrl}/feed/${feedId}`,
                        username: authorName,
                        content: trimmedContent,
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
        }

        const response: CreateCommentResponse = { approved: approved === 1, id: insertedId };
        return c.json(response, 201);
    });

    app.delete('/:id', async (c: AppContext) => {
        const db = c.get('db');
        const uid = c.get('uid');
        const admin = c.get('admin');

        if (uid === undefined) {
            throw bizError(COMMENT_ERROR_CODES.LOGIN_REQUIRED, 'Unauthorized', 401);
        }

        const id_num = parseInt(c.req.param('id'));
        if (!Number.isFinite(id_num)) {
            throw bizError(COMMENT_ERROR_CODES.COMMENT_NOT_FOUND, 'Comment not found', 404);
        }

        const comment = await profileAsync(c, 'comment_delete_lookup', () =>
            db.query.comments.findFirst({ where: eq(comments.id, id_num) }),
        );

        if (!comment) {
            throw bizError(COMMENT_ERROR_CODES.COMMENT_NOT_FOUND, 'Comment not found', 404);
        }

        // 管理员可删任意评论；普通用户只能删自己的
        if (admin) {
            await db.delete(comments).where(eq(comments.id, id_num));
            return c.json({ success: true });
        }

        if (comment.userId !== uid) {
            throw bizError(
                COMMENT_ERROR_CODES.COMMENT_PERMISSION_DENIED,
                'Permission denied',
                403,
            );
        }

        await db.delete(comments).where(eq(comments.id, id_num));
        return c.json({ success: true });
    });

    /**
     * PUT /comment/:id/approved - 通过或驳回评论（仅管理员）
     * 这是让 `approved` 字段真正发挥作用的核心接口。
     */
    app.put('/:id/approved', adminOnly(async (c: AppContext) => {
        const db = c.get('db');
        const env = c.get('env');
        const serverConfig = c.get('serverConfig');
        const id_num = parseInt(c.req.param('id'));

        if (!Number.isFinite(id_num)) {
            throw bizError(COMMENT_ERROR_CODES.COMMENT_NOT_FOUND, 'Comment not found', 404);
        }

        const validation = validateSchema<{ approved: boolean }>(commentModerationSchema, await c.req.json());
        if (!validation.success) {
            throw validationErrorFromIssues(
                COMMENT_ERROR_CODES.COMMENT_VALIDATION_FAILED,
                'Invalid moderation payload',
                validation.issues,
            );
        }

        const approved = validation.data.approved ? 1 : 0;

        const comment = await profileAsync(c, 'comment_moderate_lookup', () =>
            db.query.comments.findFirst({ where: eq(comments.id, id_num) }),
        );
        if (!comment) {
            throw bizError(COMMENT_ERROR_CODES.COMMENT_NOT_FOUND, 'Comment not found', 404);
        }

        await profileAsync(c, 'comment_moderate_update', () => db.update(comments)
            .set({ approved })
            .where(eq(comments.id, id_num)));

        // 审核通过时才补发 webhook，与创建时保持一致：站长不该收到被驳回的评论。
        if (approved === 1 && comment.approved === 0) {
            const feed = await db.query.feeds.findFirst({ where: eq(feeds.id, comment.feedId) });
            const { webhookUrl, webhookMethod, webhookContentType, webhookHeaders, webhookBodyTemplate } =
                await resolveWebhookConfig(serverConfig, env);
            const frontendUrl = new URL(c.req.url).origin;
            const authorName = comment.guestName || 'a guest';

            try {
                await notify(
                    webhookUrl || "",
                    {
                        event: "comment.created",
                        message: `${frontendUrl}/feed/${comment.feedId}\n游客 ${authorName} 评论已通过审核: ${feed?.title || ""}\n${comment.content}`,
                        title: feed?.title || "",
                        url: `${frontendUrl}/feed/${comment.feedId}`,
                        username: authorName,
                        content: comment.content,
                    },
                    {
                        method: webhookMethod,
                        contentType: webhookContentType,
                        headers: webhookHeaders,
                        bodyTemplate: webhookBodyTemplate,
                    },
                );
            } catch (error) {
                console.error("Failed to send comment webhook on approval", error);
            }
        }

        return c.json({ success: true, id: id_num, approved: approved === 1 });
    }, { format: 'json' }));

    return app;
}

/**
 * 游客评论频率限制：同一篇文章每分钟最多 GUEST_COMMENT_RATE_LIMIT 条。
 * cache 未启用时此层失效 —— 它只是叠加在 Turnstile 之上的保险，不是唯一防刷手段。
 */
async function applyGuestRateLimit(c: AppContext, feedId: string): Promise<{ allowed: boolean }> {
    const cache = c.get('cache');
    const key = `comment:rate:${feedId}`;
    const now = Date.now();
    const windowMs = 60_000;

    const existing = await cache.get(key) as { count: number; resetAt: number } | null;
    const window = existing && existing.resetAt > now
        ? existing
        : { count: 0, resetAt: now + windowMs };

    if (window.count >= GUEST_COMMENT_RATE_LIMIT) {
        return { allowed: false };
    }

    await cache.set(key, { count: window.count + 1, resetAt: window.resetAt }, true);
    return { allowed: true };
}
