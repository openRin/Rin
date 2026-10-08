// Shared API Types - Used by both client and server

export interface ApiResponse<T> {
  data?: T;
  error?: {
    status: number;
    /** 人类可读文案，仅作兜底展示，不要用它做逻辑分支 */
    value: string;
    /** 业务错误码（来自 @rin/api 的 ERROR_CODES），前端优先按 code 映射 i18n */
    code?: string;
    /** 字段级校验详情，来自服务端 ErrorDetail[] */
    details?: { field?: string; message: string }[];
  };
}

export interface RequestOptions {
  headers?: Record<string, string>;
}

// Feed Types

export interface Feed {
  /** 文章 ID：uuid 或数字文本，统一为字符串 */
  id: string;
  title: string | null;
  content: string;
  uid: number;
  createdAt: string;
  updatedAt: string;
  ai_summary: string;
  ai_summary_status: "idle" | "pending" | "processing" | "completed" | "failed";
  ai_summary_error: string;
  hashtags: Array<{ id: number; name: string }>;
  user: {
    avatar: string | null;
    id: number;
    username: string;
  };
  pv: number;
  uv: number;
  top?: number;
}

export interface FeedListResponse {
  size: number;
  data: Array<{
    id: string;
    title: string | null;
    summary: string;
    hashtags: Array<{ id: number; name: string }>;
    user: {
      avatar: string | null;
      id: number;
      username: string;
    };
    avatar: string | null;
    createdAt: string;
    updatedAt: string;
    pv: number;
    uv: number;
  }>;
  hasNext: boolean;
}

export interface TimelineItem {
  id: string;
  title: string | null;
  createdAt: string;
}

export interface CreateFeedRequest {
  title: string;
  content: string;
  summary?: string;
  alias?: string;
  draft: boolean;
  listed: boolean;
  createdAt?: string;
  tags: string[];
}

export interface UpdateFeedRequest {
  title?: string;
  content?: string;
  summary?: string;
  alias?: string;
  listed: boolean;
  draft?: boolean;
  createdAt?: string;
  tags?: string[];
  top?: number;
}

export interface AdjacentFeed {
  id: string;
  title: string | null;
  summary: string;
  hashtags: Array<{ id: number; name: string }>;
  createdAt: string;
  updatedAt: string;
}

export interface AdjacentFeedResponse {
  previousFeed: AdjacentFeed | null;
  nextFeed: AdjacentFeed | null;
}

// User Types

export interface UserProfile {
  id: number;
  username: string;
  avatar: string | null;
  permission: boolean;
}

export interface UpdateProfileRequest {
  username?: string;
  avatar?: string | null;
}

// Auth Types

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  token?: string;
  user: UserProfile;
}

// Tag Types

export interface Tag {
  id: number;
  name: string;
  count: number;
  createdAt: string;
  updatedAt: string;
}

export interface TagDetail extends Tag {
  feeds: Feed[];
}

// Comment Types

export interface Comment {
  id: number;
  content: string;
  createdAt: string;
  updatedAt: string;
  /** 登录用户的评论 */
  user?: {
    id: number;
    username: string;
    avatar: string | null;
    permission: number | null;
  } | null;
  /** 游客评论的昵称 */
  guestName?: string;
  /** 游客评论的邮箱 */
  guestEmail?: string;
  /** 游客评论的网站 */
  guestWebsite?: string;
  /** 审核状态：1 已通过 / 0 待审核 */
  approved: boolean;
}

export interface CreateCommentRequest {
  content: string;
  /** 游客昵称（未登录时必填） */
  guestName?: string;
  /** 游客邮箱（可选） */
  guestEmail?: string;
  /** 游客网站（可选） */
  guestWebsite?: string;
  /** Cloudflare Turnstile token，启用验证码时必填 */
  captchaToken?: string;
}

export interface CreateCommentResponse {
  /** 新评论是否直接可见（已登录用户自动通过，游客可能进入待审核） */
  approved: boolean;
  id: number;
}

/** 待审核评论列表项：额外带出所属文章信息，供管理端展示 */
export interface PendingComment extends Comment {
  feedId: string;
  feedTitle: string | null;
}

/** 评论管理列表响应（分页 + 可按状态筛选） */
export interface AdminCommentListResponse {
  comments: PendingComment[];
  pagination: {
    page: number;
    size: number;
    total: number;
    totalPages: number;
  };
}

// Admin Types

/** 管理员用户列表项 */
export interface AdminUserItem {
  id: number;
  username: string;
  avatar: string | null;
  email: string;
  /** 邮箱是否已通过验证码验证 */
  emailVerified: number;
  /** 0=普通用户，1=管理员 */
  permission: number;
  createdAt: number;
  /** 1 表示该账号通过邮箱注册（openid 以 `email:` 开头） */
  viaEmail: number;
}

export interface AdminUserListResponse {
  users: AdminUserItem[];
  pagination: {
    page: number;
    size: number;
    total: number;
    totalPages: number;
  };
}

export interface AdminUserDetail extends AdminUserItem {
  emailVerified: number;
  commentCount: number;
}

export interface AdminUserUpdateResponse {
  success: boolean;
  user: {
    id: number;
    username: string;
    permission: number;
  };
}

export interface AdminUserDeleteResponse {
  success: boolean;
  deleted: {
    id: number;
    username: string;
  };
}

// Plugin Types

/** 插件在后台列表里的状态 */
export type PluginStatus = 'enabled' | 'disabled' | 'error';

export interface AdminPluginItem {
  name: string;
  displayName: string;
  version: string;
  description: string;
  author: string;
  status: PluginStatus;
  /** 加载失败的原因。status 为 error 时非空 */
  error: string | null;
  /** 插件声明的扩展点，如 ['comment.beforeCreate', 'routes'] */
  capabilities: string[];
  /** 插件自定义 API 的挂载前缀；未提供 routes 时为 null */
  apiPrefix: string | null;
}

export interface AdminPluginListResponse {
  /** 启用状态在 serverConfig 里的键名，提示管理员去哪看 */
  enabledKey: string;
  plugins: AdminPluginItem[];
}

export interface PluginSettingsResponse {
  name: string;
  values: Record<string, string>;
}

export interface AdminPluginToggleResponse {
  success: boolean;
  data: {
    name: string;
    status: PluginStatus;
    enabledKey: string;
    enabledList: string[];
  };
}

// Captcha Types

/** 前端渲染 Turnstile 所需的公开配置。siteKey 可下发浏览器；secretKey 永远不下发 */
export interface CaptchaConfig {
  /** 是否要求评论必须通过人机验证 */
  enabled: boolean;
  /** 验证适用范围：`all` 所有人都验证；`guest` 仅游客验证；未设置等于关闭 */
  scope: 'all' | 'guest';
  /** Turnstile site key */
  siteKey: string;
}

// Email Registration Types

export interface RegisterRequest {
  email: string;
  username: string;
  password: string;
  /** 邮箱归属验证 token，Turnstile 开启时必填 */
  captchaToken?: string;
}

export interface RegisterVerifyRequest {
  email: string;
  /** 邮件中的 6 位验证码 */
  code: string;
}

export interface RegisterResponse {
  success: true;
  token: string;
  user: UserProfile;
}

export interface AuthStatusResponse {
  github: boolean;
  password: boolean;
  /** 邮箱注册是否可用（SMTP 配置完整且未在服务端关闭） */
  register: boolean;
}


// Friend Types

export interface Friend {
  id: number;
  name: string;
  desc: string | null;
  avatar: string;
  url: string;
  accepted: number;
  sort_order: number | null;
  createdAt: string;
  uid: number;
  updatedAt: string;
  health: string;
}

export interface FriendListResponse {
  friend_list: Friend[];
  apply_list: Friend | null;
}

export interface CreateFriendRequest {
  name: string;
  desc: string;
  avatar: string;
  url: string;
}

export interface UpdateFriendRequest {
  name: string;
  desc: string;
  avatar?: string;
  url: string;
  accepted?: number;
  sort_order?: number;
}

// Moment Types

export interface Moment {
  id: number;
  content: string;
  createdAt: string;
  updatedAt: string;
  user: {
    id: number;
    username: string;
    avatar: string;
  };
}

export interface CreateMomentRequest {
  content: string;
}

export interface MomentListResponse {
  data: Moment[];
  hasNext: boolean;
}

// Config Types

export type ConfigType = 'client' | 'server';

export interface ConfigResponse {
  [key: string]: any;
}

// AI Config Types

export interface AIConfig {
  enabled: boolean;
  provider: string;
  model: string;
  api_key: string;
  api_url: string;
}

// Storage Types

export interface UploadResponse {
  url: string;
}

// Search Types (uses FeedListResponse)

// WordPress Import Types

export interface WordPressImportResponse {
  success: number;
  skipped: number;
  skippedList: Array<{ title: string; reason: string }>;
}

// API Endpoint Paths

export const API_PATHS = {
  // Feed
  FEED_LIST: '/api/feed',
  FEED_TIMELINE: '/api/feed/timeline',
  FEED_GET: (id: number | string) => `/api/feed/${id}`,
  FEED_CREATE: '/api/feed',
  FEED_UPDATE: (id: string) => `/api/feed/${id}`,
  FEED_DELETE: (id: string) => `/api/feed/${id}`,
  FEED_ADJACENT: (id: number | string) => `/api/feed/adjacent/${id}`,
  FEED_SET_TOP: (id: string) => `/api/feed/top/${id}`,

  // Auth
  AUTH_STATUS: '/api/auth/status',
  AUTH_LOGIN: '/api/auth/login',
  AUTH_REGISTER_REQUEST: '/api/auth/register/request',
  AUTH_REGISTER_VERIFY: '/api/auth/register/verify',

  // Captcha
  CAPTCHA_CONFIG: '/api/comment/captcha',

  // User
  USER_PROFILE: '/api/user/profile',
  USER_UPDATE_PROFILE: '/api/user/profile',
  USER_LOGOUT: '/api/user/logout',
  USER_GITHUB: '/api/user/github',

  // Tag
  TAG_LIST: '/api/tag',
  TAG_GET: (name: string) => `/api/tag/${encodeURIComponent(name)}`,

  // Comment
  COMMENT_LIST: (feedId: string) => `/api/comment/${feedId}`,
  COMMENT_CREATE: (feedId: string) => `/api/comment/${feedId}`,
  COMMENT_DELETE: (id: number) => `/api/comment/${id}`,
  COMMENT_PENDING: '/api/comment/pending',
  COMMENT_SET_APPROVED: (id: number) => `/api/comment/${id}/approved`,

  // 管理员后台：用户管理
  ADMIN_USERS: '/api/admin/users',
  ADMIN_USER_DETAIL: (id: number) => `/api/admin/users/${id}`,
  ADMIN_USER_UPDATE: (id: number) => `/api/admin/users/${id}`,

  // 文章写入 API：供脚本与 CI 调用，结构化 JSON 响应，全部要求管理员权限
  FEED_WRITE: '/api/feed-write',
  FEED_WRITE_DETAIL: (id: string) => `/api/feed-write/${id}`,

  // 插件管理
  ADMIN_PLUGINS: '/api/admin/plugins',
  ADMIN_PLUGIN_TOGGLE: (name: string) => `/api/admin/plugins/${name}`,
  ADMIN_PLUGIN_SETTINGS: (name: string) => `/api/admin/plugins/${name}/settings`,

  // Friend
  FRIEND_LIST: '/api/friend',
  FRIEND_CREATE: '/api/friend',
  FRIEND_UPDATE: (id: number) => `/api/friend/${id}`,
  FRIEND_DELETE: (id: number) => `/api/friend/${id}`,

  // Moments
  MOMENTS_LIST: '/api/moments',
  MOMENTS_CREATE: '/api/moments',
  MOMENTS_UPDATE: (id: number) => `/api/moments/${id}`,
  MOMENTS_DELETE: (id: number) => `/api/moments/${id}`,

  // Config
  CONFIG_GET: (type: ConfigType) => `/config/${type}`,
  CONFIG_UPDATE: (type: ConfigType) => `/config/${type}`,
  CONFIG_CLEAR_CACHE: '/config/cache',

  // AI Config (deprecated - use CONFIG_GET/CONFIG_UPDATE with 'server' type instead)
  /** @deprecated Use CONFIG_GET('server') instead. AI config is now part of server config. */
  AI_CONFIG_GET: '/ai-config',
  /** @deprecated Use CONFIG_UPDATE('server', {...}) instead. AI config is now part of server config. */
  AI_CONFIG_UPDATE: '/ai-config',

  // Storage
  STORAGE_UPLOAD: '/storage',

  // Favicon
  FAVICON_GET: '/favicon',
  FAVICON_GET_ORIGINAL: '/favicon/original',
  FAVICON_UPLOAD: '/favicon',

  // Search
  SEARCH: (keyword: string) => `/search/${encodeURIComponent(keyword)}`,

  // WordPress
  WP_IMPORT: '/wp',

  // RSS
  RSS_GET: (name: string) => `/${encodeURIComponent(name)}`,
} as const;

export type APIEndpoint = typeof API_PATHS;
