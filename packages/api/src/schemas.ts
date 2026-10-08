// Request/Response schemas for server-side validation
import { t } from './schema-validator';

// ============================================================================
// Feed Schemas
// ============================================================================

export const feedListSchema = t.Object({
  page: t.Number({ optional: true }),
  limit: t.Number({ optional: true }),
  type: t.String({ optional: true }),
});

export const feedCreateSchema = t.Object({
  title: t.String({ minLength: 1 }),
  content: t.String({ minLength: 1 }),
  summary: t.String({ optional: true }),
  alias: t.String({ optional: true }),
  draft: t.Boolean(),
  listed: t.Boolean(),
  createdAt: t.Date({ optional: true }),
  tags: t.Array(t.String()),
});

export const feedUpdateSchema = t.Object({
  title: t.String({ optional: true }),
  alias: t.String({ optional: true }),
  content: t.String({ optional: true }),
  summary: t.String({ optional: true }),
  // optional：更新是「局部更新」，不传就表示不改。
  // 必填会让只想改标题的调用方被迫先读一遍再回传整个表单 ——
  // 网页端是整表单提交所以一直带着，但 API 调用方不该被这个约束绑住。
  listed: t.Boolean({ optional: true }),
  draft: t.Boolean({ optional: true }),
  createdAt: t.Date({ optional: true }),
  tags: t.Array(t.String(), { optional: true }),
  top: t.Numeric({ optional: true }),
});

export const feedSetTopSchema = t.Object({
  top: t.Numeric(),
});

// ============================================================================
// Auth Schemas
// ============================================================================

/** 密码长度下限，与服务端 AUTH_PASSWORD_MIN_LENGTH 保持一致 */
export const AUTH_PASSWORD_MIN_LENGTH = 8;
/** 用户名长度上限 */
export const AUTH_USERNAME_MAX_LENGTH = 32;
/** 验证码长度 */
export const AUTH_CODE_LENGTH = 6;

export const loginSchema = t.Object({
  username: t.String({ minLength: 1, maxLength: AUTH_USERNAME_MAX_LENGTH }),
  password: t.String({ minLength: 1, maxLength: 128 }),
});

export const registerRequestSchema = t.Object({
  email: t.String({ minLength: 3, maxLength: 254, format: 'email' }),
  username: t.String({ minLength: 1, maxLength: AUTH_USERNAME_MAX_LENGTH }),
  password: t.String({ minLength: AUTH_PASSWORD_MIN_LENGTH, maxLength: 128 }),
  captchaToken: t.String({ optional: true, maxLength: 2048 }),
});

// ============================================================================
// User Schemas
// ============================================================================

export const updateProfileSchema = t.Object({
  username: t.String({ optional: true }),
  avatar: t.String({ optional: true }),
});

// ============================================================================
// Comment Schemas
// ============================================================================

/** 评论内容长度上限，与服务端 COMMENT_CONTENT_MAX_LENGTH 保持一致 */
export const COMMENT_CONTENT_MAX_LENGTH = 2000;
/** 游客昵称长度上限 */
export const COMMENT_GUEST_NAME_MAX_LENGTH = 50;

export const commentCreateSchema = t.Object({
  content: t.String({ minLength: 1, maxLength: COMMENT_CONTENT_MAX_LENGTH }),
  guestName: t.String({ optional: true, maxLength: COMMENT_GUEST_NAME_MAX_LENGTH }),
  guestEmail: t.String({ optional: true, format: 'email' }),
  guestWebsite: t.String({ optional: true, maxLength: 200 }),
  captchaToken: t.String({ optional: true, maxLength: 2048 }),
});

export const commentModerationSchema = t.Object({
  approved: t.Boolean(),
});

export const registerVerifySchema = t.Object({
  email: t.String({ minLength: 3, maxLength: 254, format: 'email' }),
  code: t.String({ minLength: AUTH_CODE_LENGTH, maxLength: AUTH_CODE_LENGTH }),
});


// ============================================================================
// Friend Schemas
// ============================================================================

export const friendCreateSchema = t.Object({
  name: t.String(),
  desc: t.String(),
  avatar: t.String(),
  url: t.String(),
});

export const friendUpdateSchema = t.Object({
  name: t.String(),
  desc: t.String(),
  avatar: t.String({ optional: true }),
  url: t.String(),
  accepted: t.Numeric({ optional: true }),
  sort_order: t.Numeric({ optional: true }),
});

// ============================================================================
// Moment Schemas
// ============================================================================

export const momentCreateSchema = t.Object({
  content: t.String(),
});

export const momentUpdateSchema = t.Object({
  content: t.String(),
});

// ============================================================================
// AI Config Schemas
// ============================================================================

export const aiConfigUpdateSchema = t.Object({
  enabled: t.Boolean({ optional: true }),
  provider: t.String({ optional: true }),
  model: t.String({ optional: true }),
  api_key: t.String({ optional: true }),
  api_url: t.String({ optional: true }),
});

// ============================================================================
// WordPress Import Schemas
// ============================================================================

export const wpImportSchema = t.Object({
  data: t.File(),
});

// ============================================================================
// Search Schemas
// ============================================================================

export const searchSchema = t.Object({
  page: t.Number({ optional: true }),
  limit: t.Number({ optional: true }),
});
