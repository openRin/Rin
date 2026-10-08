/**
 * 文章写入 API —— 供脚本、CI、外部工具调用。
 * 与网页端 POST /api/feed 的区别：结构化 JSON 响应（带 success/code）、
 * 支持 dryRun 试运行。所有端点要求管理员，`adminOnly` 是唯一鉴权入口。
 */

import { Hono } from "hono";
import {
  feedCreateSchema,
  feedUpdateSchema,
  validateSchema,
  API_ERROR_CODES,
  FEED_ERROR_CODES,
  type CreateFeedRequest,
  type UpdateFeedRequest,
} from "@rin/api";
import type { AppContext } from "../core/hono-types";
import { profileAsync } from "../core/server-timing";
import {
  deleteFeedById,
  findDuplicateFeed,
  findFeedById,
  insertFeed,
  updateFeedById,
} from "../features/feed/repository";
import { syncFeedAISummaryQueueState } from "./feed-ai-summary";
import { bindTagToPost } from "./tag";
import { clearFeedCache, clearFeedCollectionCaches } from "./clear-feed-cache";

/** 统一的成功响应 */
function ok<T>(c: AppContext, data: T, status: 200 | 201 = 200) {
  return c.json({ success: true, data }, status);
}

/** 统一的错误响应。code 供脚本分支处理，message 人类可读 */
function fail(c: AppContext, code: string, message: string, status: 400 | 401 | 403 | 404 | 409 | 500) {
  return c.json({ success: false, error: { code, message } }, status);
}

/**
 * 管理员 JSON 鉴权包装。
 *
 * 与 `adminOnly` 的区别是返回结构化 JSON —— 脚本需要能解析的错误格式。
 * 状态码：未登录 401、已登录但非管理员 403。
 */
function adminApi(handler: (c: AppContext) => Promise<Response> | Response) {
  return async (c: AppContext) => {
    if (!c.get('uid')) {
      return fail(c, API_ERROR_CODES.AUTH_LOGIN_REQUIRED, 'Authentication required', 401);
    }
    if (!c.get('admin')) {
      return fail(c, FEED_ERROR_CODES.FEED_PERMISSION_DENIED, 'Administrator permission required', 403);
    }
    return handler(c);
  };
}

export function FeedWriteApiService(): Hono {
  const app = new Hono();

  /**
   * POST /api/feed-write
   *
   * 创建文章。支持 `?dryRun=1` 只校验不写库。
   */
  app.post('/', adminApi(async (c: AppContext) => {
    const body = await c.req.json().catch(() => null);
    if (body === null) {
      return fail(c, FEED_ERROR_CODES.FEED_VALIDATION_FAILED, 'Invalid JSON body', 400);
    }

    // dryRun 放在 body 里而不是 query：同一套 payload，加个字段就能切换试运行
    const isDryRun = body.dryRun === true;
    const payload = { ...body };
    delete payload.dryRun;

    const validation = validateSchema<CreateFeedRequest>(feedCreateSchema, payload);
    if (!validation.success) {
      return fail(
        c,
        FEED_ERROR_CODES.FEED_VALIDATION_FAILED,
        firstIssue(validation.issues),
        400,
      );
    }

    const { title, alias, listed, content, summary, draft, tags, createdAt } = validation.data;
    const db = c.get('db');
    const uid = c.get('uid') as number;

    // 重复检测放在 dryRun 之外：调用方也想在试运行时知道会冲突
    const duplicate = await profileAsync(c, 'feed_write_duplicate', () =>
      findDuplicateFeed(db, title, content),
    );
    if (duplicate) {
      return fail(
        c,
        FEED_ERROR_CODES.FEED_ALREADY_EXISTS,
        `An article with the same title and content already exists (id=${duplicate.id})`,
        409,
      );
    }

    if (isDryRun) {
      // 试运行：把校验结果与将要写入的字段回给调用方，但不碰数据库
      return ok(c, {
        dryRun: true,
        created: false,
        wouldCreate: {
          title,
          alias: alias ?? '',
          listed: Boolean(listed),
          draft: Boolean(draft),
          tags,
          contentLength: content.length,
          createdAt: createdAt ? new Date(createdAt).toISOString() : new Date().toISOString(),
        },
      });
    }

    const date = createdAt ? new Date(createdAt) : new Date();

    // 新文章 ID 按后台 `feed.id_mode` 生成：uuid（默认）或连续数字
    const idMode = await c.get('serverConfig').getOrDefault<'uuid' | 'number'>('feed.id_mode', 'uuid');

    const result = await profileAsync(c, 'feed_write_insert', () =>
      insertFeed(db, {
        title,
        content,
        summary: summary ?? '',
        ai_summary: '',
        ai_summary_status: 'idle',
        ai_summary_error: '',
        uid,
        alias,
        listed: listed ? 1 : 0,
        draft: draft ? 1 : 0,
        createdAt: date,
        updatedAt: date,
      }, idMode),
    );

    if (!result) {
      return fail(c, 'FEED_CREATE_FAILED', 'Failed to insert the article', 500);
    }

    // 后续步骤逐步 try：任一失败不该让已创建的文章变成「半成品」状态。
    try {
      await profileAsync(c, 'feed_write_tags', () => bindTagToPost(db, result.insertedId, tags));
    } catch (error) {
      console.error('[feed-write] tag binding failed', error);
    }

    try {
      await profileAsync(c, 'feed_write_ai_queue', () =>
        syncFeedAISummaryQueueState(db, c.get('serverConfig'), c.get('env'), result.insertedId, {
          draft: Boolean(draft),
          updatedAt: date,
          resetSummary: true,
        }),
      );
    } catch (error) {
      console.error('[feed-write] AI summary queue sync failed', error);
    }

    try {
      await profileAsync(c, 'feed_write_cache', () => clearFeedCollectionCaches(c.get('cache')));
    } catch (error) {
      console.error('[feed-write] cache invalidation failed', error);
    }

    return ok(c, {
      dryRun: false,
      created: true,
      id: result.insertedId,
      url: alias ? `/post/${alias}` : `/feed/${result.insertedId}`,
      title,
      draft: Boolean(draft),
    }, 201);
  }));

  /**
   * PUT /api/feed-write/:id
   *
   * 更新文章。所有字段可选，只传要改的。
   */
  app.put('/:id', adminApi(async (c: AppContext) => {
    const id = c.req.param('id');
    if (!id.trim()) {
      return fail(c, FEED_ERROR_CODES.FEED_VALIDATION_FAILED, 'Invalid article id', 400);
    }

    const body = await c.req.json().catch(() => null);
    if (body === null) {
      return fail(c, FEED_ERROR_CODES.FEED_VALIDATION_FAILED, 'Invalid JSON body', 400);
    }

    const isDryRun = body.dryRun === true;
    const payload = { ...body };
    delete payload.dryRun;

    const validation = validateSchema<UpdateFeedRequest>(feedUpdateSchema, payload);
    if (!validation.success) {
      return fail(
        c,
        FEED_ERROR_CODES.FEED_VALIDATION_FAILED,
        firstIssue(validation.issues),
        400,
      );
    }

    const db = c.get('db');

    const existing = await profileAsync(c, 'feed_write_lookup', () => findFeedById(db, id));
    if (!existing) {
      return fail(c, FEED_ERROR_CODES.FEED_NOT_FOUND, 'Article not found', 404);
    }

    const { title, alias, content, summary, listed, draft, tags, createdAt } = validation.data;
    const date = new Date();

    if (isDryRun) {
      return ok(c, {
        dryRun: true,
        updated: false,
        wouldUpdate: {
          title: title ?? existing.title,
          alias: alias ?? existing.alias ?? '',
          listed: listed === undefined ? Boolean(existing.listed) : Boolean(listed),
          draft: draft === undefined ? Boolean(existing.draft) : Boolean(draft),
          tags: tags ?? [],
          contentChanged: content !== undefined,
        },
      });
    }

    // 只更新传入的字段：undefined 表示「不改」，不能用 || 兜底（会把显式空串当成不改）
    await profileAsync(c, 'feed_write_update', () =>
      updateFeedById(db, id, {
        title,
        content,
        summary,
        alias,
        listed: listed === undefined ? undefined : (listed ? 1 : 0),
        draft: draft === undefined ? undefined : (draft ? 1 : 0),
        createdAt: createdAt ? new Date(createdAt) : undefined,
        updatedAt: date,
      }),
    );

    if (tags !== undefined) {
      try {
        await profileAsync(c, 'feed_write_tags', () => bindTagToPost(db, id, tags));
      } catch (error) {
        console.error('[feed-write] tag binding failed', error);
      }
    }

    try {
      await profileAsync(c, 'feed_write_ai_queue', () =>
        syncFeedAISummaryQueueState(db, c.get('serverConfig'), c.get('env'), id, {
          draft: draft === undefined ? Boolean(existing.draft) : Boolean(draft),
          updatedAt: date,
          resetSummary: content !== undefined,
        }),
      );
    } catch (error) {
      console.error('[feed-write] AI summary queue sync failed', error);
    }

    // 更新后要清掉单篇缓存，否则详情页会返回旧内容
    try {
      await profileAsync(c, 'feed_write_cache', async () => {
        await clearFeedCache(c.get('cache'), id, existing.alias, (alias ?? existing.alias) || null);
        await clearFeedCollectionCaches(c.get('cache'));
      });
    } catch (error) {
      console.error('[feed-write] cache invalidation failed', error);
    }

    return ok(c, {
      dryRun: false,
      updated: true,
      id,
      url: (alias ?? existing.alias) ? `/post/${alias ?? existing.alias}` : `/feed/${id}`,
    });
  }));

  /**
   * DELETE /api/feed-write/:id
   *
   * 永久删除文章。这是不可逆操作，**要求显式传 `?confirm=<id>`**，
   * 避免脚本误传 id 就把文章删了。
   */
  app.delete('/:id', adminApi(async (c: AppContext) => {
    const id = c.req.param('id');
    if (!id.trim()) {
      return fail(c, FEED_ERROR_CODES.FEED_VALIDATION_FAILED, 'Invalid article id', 400);
    }

    // 二次确认：必须带 confirm，且值与 id 一致
    const confirm = c.req.query('confirm');
    if (confirm !== String(id)) {
      return fail(
        c,
        FEED_ERROR_CODES.FEED_VALIDATION_FAILED,
        `Deletion requires ?confirm=${id} to match the article id`,
        400,
      );
    }

    const db = c.get('db');
    const existing = await profileAsync(c, 'feed_write_lookup', () => findFeedById(db, id));
    if (!existing) {
      return fail(c, FEED_ERROR_CODES.FEED_NOT_FOUND, 'Article not found', 404);
    }

    // 走 repository 的删除逻辑，保证标签关联、缓存、统计一起清理
    const deleted = await profileAsync(c, 'feed_write_delete', () => deleteFeedById(db, id));

    if (!deleted) {
      return fail(c, 'FEED_DELETE_FAILED', 'Failed to delete the article', 500);
    }

    try {
      await profileAsync(c, 'feed_write_cache', async () => {
        // 删除场景没有新 alias，newAlias 传原值表示「只清旧的」
        await clearFeedCache(c.get('cache'), id, existing.alias, existing.alias);
        await clearFeedCollectionCaches(c.get('cache'));
      });
    } catch (error) {
      console.error('[feed-write] cache invalidation failed', error);
    }

    return ok(c, { deleted: true, id, title: existing.title });
  }));

  /**
   * GET /api/feed-write/:id
   *
   * 读单篇。写 API 的配套读接口，方便脚本确认写入结果。
   */
  app.get('/:id', adminApi(async (c: AppContext) => {
    const id = c.req.param('id');
    if (!id.trim()) {
      return fail(c, FEED_ERROR_CODES.FEED_VALIDATION_FAILED, 'Invalid article id', 400);
    }

    const db = c.get('db');
    const feed = await profileAsync(c, 'feed_write_get', () =>
      findFeedById(db, id),
    );

    if (!feed) {
      return fail(c, FEED_ERROR_CODES.FEED_NOT_FOUND, 'Article not found', 404);
    }

    return ok(c, feed);
  }));

  return app;
}

/** 取第一条校验错误作为 message，避免整个 issues 数组塞进响应 */
function firstIssue(issues: { message: string }[]): string {
  return issues[0]?.message ?? 'Invalid request body';
}
