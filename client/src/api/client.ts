// API Client for Rin - Type-safe HTTP client to replace Eden
// This client provides a clean, type-safe interface for all backend API endpoints

import { getAuthToken } from "../utils/auth";
import { endpoint } from "../config";

// Import shared types
import type {
  ApiResponse,
  RequestOptions,
  Feed,
  FeedListResponse,
  TimelineItem,
  CreateFeedRequest,
  UpdateFeedRequest,
  AdjacentFeedResponse,
  UserProfile,
  UpdateProfileRequest,
  Tag,
  TagDetail,
  Comment,
  CreateCommentRequest,
  CreateCommentResponse,
  AdminCommentListResponse,
  CaptchaConfig,
  RegisterRequest,
  RegisterVerifyRequest,
  RegisterResponse,
  AuthStatusResponse,
  AdminUserListResponse,
  AdminUserDetail,
  AdminUserUpdateResponse,
  AdminUserDeleteResponse,
  AdminPluginListResponse,
  AdminPluginToggleResponse,
  PluginSettingsResponse,
  Friend,
  FriendListResponse,
  CreateFriendRequest,
  UpdateFriendRequest,
  Moment,
  CreateMomentRequest,
  ConfigType,
  ConfigResponse,
  AIConfig,
  UploadResponse,
  LoginRequest,
  LoginResponse,
} from "@rin/api";

// 端点常量与类型同源，避免路径在前端各处硬编码后与服务端漂移
import { API_PATHS } from "@rin/api";

export interface SettingsConfigResponse {
  clientConfig: ConfigResponse;
  serverConfig: ConfigResponse;
}

export interface ConfigHealthItem {
  id: string;
  title: {
    key: string;
    values?: Record<string, string | number | boolean>;
  };
  status: "success" | "warning" | "danger";
  configured: boolean;
  impact: {
    key: string;
    values?: Record<string, string | number | boolean>;
  };
  summary: {
    key: string;
    values?: Record<string, string | number | boolean>;
  };
  suggestion?: {
    key: string;
    values?: Record<string, string | number | boolean>;
  };
  details?: Array<{
    key: string;
    values?: Record<string, string | number | boolean>;
  }>;
}

export interface ConfigHealthResponse {
  generatedAt: string;
  summary: Record<"success" | "warning" | "danger", number>;
  items: ConfigHealthItem[];
}

export interface QueueStatusItem {
  /** 所属文章 ID（字符串） */
  id: string;
  title: string | null;
  aiSummaryStatus: "idle" | "pending" | "processing" | "completed" | "failed";
  aiSummaryError: string;
  updatedAt: string;
  createdAt: string;
}

export interface QueueStatusResponse {
  queueConfigured: boolean;
  generatedAt: string;
  summary: Record<"idle" | "pending" | "processing" | "completed" | "failed", number>;
  items: QueueStatusItem[];
}

export interface QueueTaskActionResponse {
  success: boolean;
}

export interface CompatTasksResponse {
  generatedAt: string;
  aiSummary: {
    enabled: boolean;
    queueConfigured: boolean;
    eligible: number;
    forceEligible: number;
  };
  blurhash: {
    eligible: number;
  };
}

export interface CompatAISummaryActionResponse {
  queued: number;
  skipped: number;
  forced: boolean;
}

export interface CompatBlurhashCandidate {
  /** 文章 ID（字符串） */
  id: string;
  title: string | null;
  content: string;
}

export interface CompatBlurhashCandidatesResponse {
  generatedAt: string;
  items: CompatBlurhashCandidate[];
}

export interface CompatBlurhashApplyResponse {
  updated: boolean;
}

/**
 * 管理端「文章统一管理」类型。
 * packages/api 尚未收录这组契约，先在客户端本地声明；服务端见 server/src/services/admin-feeds.ts
 */
export interface AdminArticleItem {
  id: string;
  title: string | null;
  alias: string | null;
  summary: string;
  draft: number;
  listed: number;
  top: number;
  createdAt: string;
  updatedAt: string;
  commentCount: number;
  pv: number;
}

export interface AdminArticleListResponse {
  feeds: AdminArticleItem[];
  pagination: {
    page: number;
    size: number;
    total: number;
    totalPages: number;
  };
}

export interface AdminArticleBatchDeleteResponse {
  deleted: number;
  missing: string[];
}

// Re-export for external use
export type {
  ApiResponse,
  RequestOptions,
  Feed,
  FeedListResponse,
  TimelineItem,
  CreateFeedRequest,
  UpdateFeedRequest,
  AdjacentFeedResponse,
  UserProfile,
  UpdateProfileRequest,
  Tag,
  TagDetail,
  Comment,
  CreateCommentRequest,
  Friend,
  FriendListResponse,
  CreateFriendRequest,
  UpdateFriendRequest,
  Moment,
  CreateMomentRequest,
  ConfigType,
  ConfigResponse,
  AIConfig,
  UploadResponse,
  LoginRequest,
  LoginResponse,
} from "@rin/api";


/**
 * HTTP client for making API requests
 */
class HttpClient {
  constructor(private baseUrl: string) {}

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    options?: RequestOptions
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      Accept: "application/json",
      ...options?.headers,
    };

    // Add auth token if available
    const token = getAuthToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    if (body !== undefined && !(body instanceof FormData)) {
      headers["Content-Type"] = "application/json";
    }

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
        credentials: "include",
      });

      // Handle 204 No Content
      if (response.status === 204) {
        return { data: undefined as T };
      }

      if (!response.ok) {
        let errorValue: unknown;
        const responseClone = response.clone();
        try {
          errorValue = await response.json();
        } catch {
          errorValue = await responseClone.text();
        }
        // Extract error code and message from various formats.
        // 关键：优先取 `code`，它是稳定的业务标识；`message` 只作兜底展示。
        let errorMessage: string;
        let errorCode: string | undefined;
        let errorDetails: { field?: string; message: string }[] | undefined;
        if (typeof errorValue === 'string') {
          errorMessage = errorValue;
        } else if (errorValue && typeof errorValue === 'object') {
          // Handle { error: { code, message, details } } format
          const err = errorValue as any;
          const nested = typeof err.error === 'object' && err.error ? err.error : err;
          errorCode = typeof nested.code === 'string' ? nested.code : undefined;
          errorMessage = nested.message || err.message || err.error || JSON.stringify(errorValue);
          if (Array.isArray(nested.details)) {
            errorDetails = nested.details;
          }
        } else {
          errorMessage = String(errorValue ?? response.statusText);
        }
        return {
          error: {
            status: response.status,
            value: errorMessage,
            code: errorCode,
            details: errorDetails,
          },
        };
      }

      // Check if response has content
      const contentLength = response.headers.get("content-length");
      if (contentLength === "0") {
        return { data: undefined as T };
      }

      // Try to parse JSON, fallback to text
      const contentType = response.headers.get("content-type");
      if (contentType?.includes("application/json")) {
        const data = await response.json();
        return { data };
      }

      const text = await response.text();
      return { data: text as T };
    } catch (error) {
      return {
        error: {
          status: 0,
          value: error instanceof Error ? error.message : "Network error",
        },
      };
    }
  }

  async get<T>(path: string, options?: RequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>("GET", path, undefined, options);
  }

  async post<T>(path: string, body?: unknown, options?: RequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>("POST", path, body, options);
  }

  async put<T>(path: string, body?: unknown, options?: RequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>("PUT", path, body, options);
  }

  async patch<T>(path: string, body?: unknown, options?: RequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>("PATCH", path, body, options);
  }

  async delete<T>(path: string, options?: RequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>("DELETE", path, undefined, options);
  }
}

/**
 * Feed API methods
 */
class FeedAPI {
  constructor(private http: HttpClient) {}

  // GET /api/feed
  async list(params?: { page?: number; limit?: number; type?: 'draft' | 'unlisted' | 'normal' }): Promise<ApiResponse<FeedListResponse>> {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set("page", params.page.toString());
    if (params?.limit) searchParams.set("limit", params.limit.toString());
    if (params?.type) searchParams.set("type", params.type);
    
    const query = searchParams.toString();
    return this.http.get<FeedListResponse>(`/api/feed${query ? `?${query}` : ""}`);
  }

  // GET /api/feed/timeline
  async timeline(): Promise<ApiResponse<TimelineItem[]>> {
    return this.http.get<TimelineItem[]>("/api/feed/timeline");
  }

  // GET /api/feed/:id
  async get(id: number | string): Promise<ApiResponse<Feed>> {
    return this.http.get<Feed>(`/api/feed/${id}`);
  }

  // POST /api/feed
  async create(body: CreateFeedRequest): Promise<ApiResponse<{ insertedId: string }>> {
    return this.http.post<{ insertedId: string }>("/api/feed", body);
  }

  // POST /api/feed/:id
  async update(id: string, body: UpdateFeedRequest): Promise<ApiResponse<void>> {
    return this.http.post<void>(`/api/feed/${id}`, body);
  }

  // DELETE /api/feed/:id
  async delete(id: string): Promise<ApiResponse<void>> {
    return this.http.delete<void>(`/api/feed/${id}`);
  }

  // GET /api/feed/adjacent/:id
  async adjacent(id: number | string): Promise<ApiResponse<AdjacentFeedResponse>> {
    return this.http.get<AdjacentFeedResponse>(`/api/feed/adjacent/${id}`);
  }

  // POST /api/feed/top/:id
  async setTop(id: string, top: number): Promise<ApiResponse<void>> {
    return this.http.post<void>(`/api/feed/top/${id}`, { top });
  }
}

/**
 * Tag API methods
 */
class TagAPI {
  constructor(private http: HttpClient) {}

  // GET /api/tag
  async list(): Promise<ApiResponse<Tag[]>> {
    return this.http.get<Tag[]>("/api/tag");
  }

  // GET /api/tag/:name
  async get(name: string): Promise<ApiResponse<TagDetail>> {
    return this.http.get<TagDetail>(`/api/tag/${encodeURIComponent(name)}`);
  }
}

/**
 * Comment API methods
 */
class CommentAPI {
  constructor(private http: HttpClient) {}

  // GET /api/comment/:feed
  async list(feedId: string): Promise<ApiResponse<Comment[]>> {
    return this.http.get<Comment[]>(API_PATHS.COMMENT_LIST(feedId));
  }

  // POST /api/comment/:feed
  async create(feedId: string, body: CreateCommentRequest): Promise<ApiResponse<CreateCommentResponse>> {
    return this.http.post<CreateCommentResponse>(API_PATHS.COMMENT_CREATE(feedId), body);
  }

  // DELETE /api/comment/:id
  async delete(id: number): Promise<ApiResponse<void>> {
    return this.http.delete<void>(API_PATHS.COMMENT_DELETE(id));
  }

  // GET /api/comment/captcha - 渲染 Turnstile 所需的公开配置
  async captchaConfig(): Promise<ApiResponse<CaptchaConfig>> {
    return this.http.get<CaptchaConfig>(API_PATHS.CAPTCHA_CONFIG);
  }

  // GET /api/comment/pending - 评论管理列表（支持按状态筛选与分页）
  async listComments(
    params: { filter?: 'pending' | 'approved' | 'all'; page?: number; size?: number } = {},
  ): Promise<ApiResponse<AdminCommentListResponse>> {
    const query = new URLSearchParams();
    query.set('filter', params.filter ?? 'pending');
    if (params.page) query.set('page', String(params.page));
    if (params.size) query.set('size', String(params.size));

    return this.http.get<AdminCommentListResponse>(
      `${API_PATHS.COMMENT_PENDING}?${query.toString()}`,
    );
  }

  // PUT /api/comment/:id/approved - 通过或驳回评论（管理员）
  async setApproved(id: number, approved: boolean): Promise<ApiResponse<{ id: number; approved: boolean }>> {
    return this.http.put<{ id: number; approved: boolean }>(
      API_PATHS.COMMENT_SET_APPROVED(id),
      { approved },
    );
  }

  // DELETE /api/comment/:id — 永久删除评论（管理员可删任意，用户只能删自己的）
  async remove(id: number): Promise<ApiResponse<{ success: boolean }>> {
    return this.http.delete<{ success: boolean }>(API_PATHS.COMMENT_DELETE(id));
  }
}

/**
 * User API methods
 */
class UserAPI {
  constructor(private http: HttpClient) {}

  // GET /api/user/profile
  async profile(): Promise<ApiResponse<UserProfile>> {
    return this.http.get<UserProfile>("/api/user/profile");
  }

  // PUT /api/user/profile
  async updateProfile(body: UpdateProfileRequest): Promise<ApiResponse<{ success: boolean }>> {
    return this.http.put<{ success: boolean }>("/api/user/profile", body);
  }

  // POST /api/user/logout
  async logout(): Promise<ApiResponse<void>> {
    return this.http.post<void>("/api/user/logout");
  }

  // GET /api/user/github
  githubAuth(): string {
    return `${endpoint}/api/user/github`;
  }
}

/**
 * 管理员后台 API（用户管理）
 */
class AdminUserAPI {
  constructor(private http: HttpClient) {}

  // GET /api/admin/users?page=1&size=20&keyword=xxx
  async list(
    params: { page?: number; size?: number; keyword?: string } = {},
  ): Promise<ApiResponse<AdminUserListResponse>> {
    const query = new URLSearchParams();
    if (params.page) query.set('page', String(params.page));
    if (params.size) query.set('size', String(params.size));
    if (params.keyword) query.set('keyword', params.keyword);

    const suffix = query.toString();
    return this.http.get<AdminUserListResponse>(
      suffix ? `${API_PATHS.ADMIN_USERS}?${suffix}` : API_PATHS.ADMIN_USERS,
    );
  }

  // GET /api/admin/users/:id
  async detail(id: number): Promise<ApiResponse<AdminUserDetail>> {
    return this.http.get<AdminUserDetail>(API_PATHS.ADMIN_USER_DETAIL(id));
  }

  // PUT /api/admin/users/:id — permission: 0 普通用户 / 1 管理员
  async setPermission(
    id: number,
    permission: 0 | 1,
  ): Promise<ApiResponse<AdminUserUpdateResponse>> {
    return this.http.put<AdminUserUpdateResponse>(API_PATHS.ADMIN_USER_UPDATE(id), {
      permission: String(permission),
    });
  }

  // DELETE /api/admin/users/:id
  async remove(id: number): Promise<ApiResponse<AdminUserDeleteResponse>> {
    return this.http.delete<AdminUserDeleteResponse>(API_PATHS.ADMIN_USER_DETAIL(id));
  }
}

/**
 * 插件管理 API
 */
class AdminPluginAPI {
  constructor(private http: HttpClient) {}

  // GET /api/admin/plugins
  async list(): Promise<ApiResponse<AdminPluginListResponse>> {
    return this.http.get<AdminPluginListResponse>(API_PATHS.ADMIN_PLUGINS);
  }

  // PUT /api/admin/plugins/:name — 启用或停用
  async setEnabled(
    name: string,
    enabled: boolean,
  ): Promise<ApiResponse<AdminPluginToggleResponse>> {
    return this.http.put<AdminPluginToggleResponse>(API_PATHS.ADMIN_PLUGIN_TOGGLE(name), {
      enabled,
    });
  }

  // GET /api/admin/plugins/:name/settings
  async getSettings(name: string): Promise<ApiResponse<PluginSettingsResponse>> {
    return this.http.get<PluginSettingsResponse>(API_PATHS.ADMIN_PLUGIN_SETTINGS(name));
  }

  // PUT /api/admin/plugins/:name/settings — 批量保存
  async saveSettings(
    name: string,
    values: Record<string, string>,
  ): Promise<ApiResponse<{ success: boolean; data: { name: string; values: Record<string, string> } }>> {
    return this.http.put(API_PATHS.ADMIN_PLUGIN_SETTINGS(name), { values });
  }
}

/**
 * 管理员后台 API（文章统一管理：含草稿/未列出）
 */
class AdminFeedsAPI {
  constructor(private http: HttpClient) {}

  // GET /api/admin/feeds?page=1&size=20&keyword=xxx
  async list(
    params: { page?: number; size?: number; keyword?: string } = {},
  ): Promise<ApiResponse<AdminArticleListResponse>> {
    const query = new URLSearchParams();
    if (params.page) query.set('page', String(params.page));
    if (params.size) query.set('size', String(params.size));
    if (params.keyword) query.set('keyword', params.keyword);

    const suffix = query.toString();
    return this.http.get<AdminArticleListResponse>(
      suffix ? `/api/admin/feeds?${suffix}` : '/api/admin/feeds',
    );
  }

  // POST /api/admin/feeds/batch-delete — body: { ids: string[] }
  async batchDelete(ids: string[]): Promise<ApiResponse<AdminArticleBatchDeleteResponse>> {
    return this.http.post<AdminArticleBatchDeleteResponse>('/api/admin/feeds/batch-delete', { ids });
  }
}

/**
 * Friend API methods
 */
class FriendAPI {
  constructor(private http: HttpClient) {}

  // GET /api/friend
  async list(): Promise<ApiResponse<FriendListResponse>> {
    return this.http.get<FriendListResponse>("/api/friend");
  }

  // POST /api/friend
  async create(body: CreateFriendRequest): Promise<ApiResponse<Friend>> {
    return this.http.post<Friend>("/api/friend", body);
  }

  // PUT /api/friend/:id
  async update(id: number, body: UpdateFriendRequest): Promise<ApiResponse<Friend>> {
    return this.http.put<Friend>(`/api/friend/${id}`, body);
  }

  // DELETE /api/friend/:id
  async delete(id: number): Promise<ApiResponse<void>> {
    return this.http.delete<void>(`/api/friend/${id}`);
  }
}

/**
 * Moments API methods
 */
class MomentsAPI {
  constructor(private http: HttpClient) {}

  // GET /api/moments
  async list(params?: { page?: number; limit?: number }): Promise<ApiResponse<{ data: Moment[]; hasNext: boolean }>> {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set("page", params.page.toString());
    if (params?.limit) searchParams.set("limit", params.limit.toString());
    
    const query = searchParams.toString();
    return this.http.get<{ data: Moment[]; hasNext: boolean }>(`/api/moments${query ? `?${query}` : ""}`);
  }

  // POST /api/moments
  async create(body: CreateMomentRequest): Promise<ApiResponse<Moment>> {
    return this.http.post<Moment>("/api/moments", body);
  }

  // POST /api/moments/:id
  async update(id: number, body: CreateMomentRequest): Promise<ApiResponse<Moment>> {
    return this.http.post<Moment>(`/api/moments/${id}`, body);
  }

  // DELETE /api/moments/:id
  async delete(id: number): Promise<ApiResponse<void>> {
    return this.http.delete<void>(`/api/moments/${id}`);
  }
}

/**
 * Config API methods
 */
class ConfigAPI {
  constructor(private http: HttpClient) {}

  // GET /api/config
  async getAll(): Promise<ApiResponse<SettingsConfigResponse>> {
    return this.http.get<SettingsConfigResponse>("/api/config");
  }

  // GET /api/config/:type
  async get(type: ConfigType): Promise<ApiResponse<ConfigResponse>> {
    return this.http.get<ConfigResponse>(`/api/config/${type}`);
  }

  // POST /api/config
  async updateAll(body: SettingsConfigResponse): Promise<ApiResponse<SettingsConfigResponse>> {
    return this.http.post<SettingsConfigResponse>("/api/config", body);
  }

  // POST /api/config/:type
  async update(type: ConfigType, body: Record<string, unknown>): Promise<ApiResponse<void>> {
    return this.http.post<void>(`/api/config/${type}`, body);
  }

  // DELETE /api/config/cache
  async clearCache(): Promise<ApiResponse<void>> {
    return this.http.delete<void>("/api/config/cache");
  }

  // GET /api/config/health
  async getHealth(): Promise<ApiResponse<ConfigHealthResponse>> {
    return this.http.get<ConfigHealthResponse>("/api/config/health");
  }

  // GET /api/config/queue-status
  async getQueueStatus(): Promise<ApiResponse<QueueStatusResponse>> {
    return this.http.get<QueueStatusResponse>("/api/config/queue-status");
  }

  async getCompatTasks(): Promise<ApiResponse<CompatTasksResponse>> {
    return this.http.get<CompatTasksResponse>("/api/config/compat-tasks");
  }

  async runCompatAISummary(force = false): Promise<ApiResponse<CompatAISummaryActionResponse>> {
    return this.http.post<CompatAISummaryActionResponse>("/api/config/compat-tasks/ai-summary", { force });
  }

  async getCompatBlurhashCandidates(): Promise<ApiResponse<CompatBlurhashCandidatesResponse>> {
    return this.http.get<CompatBlurhashCandidatesResponse>("/api/config/compat-tasks/blurhash");
  }

  async applyCompatBlurhash(feedId: string, content: string): Promise<ApiResponse<CompatBlurhashApplyResponse>> {
    return this.http.post<CompatBlurhashApplyResponse>(`/api/config/compat-tasks/blurhash/${feedId}`, { content });
  }

  async retryQueueTask(feedId: string): Promise<ApiResponse<QueueTaskActionResponse>> {
    return this.http.post<QueueTaskActionResponse>(`/api/config/queue-status/${feedId}/retry`);
  }

  async deleteQueueTask(feedId: string): Promise<ApiResponse<QueueTaskActionResponse>> {
    return this.http.delete<QueueTaskActionResponse>(`/api/config/queue-status/${feedId}`);
  }

  // POST /api/config/test-ai - Test AI model configuration
  async testAI(body: {
    provider?: string;
    model?: string;
    api_url?: string;
    api_key?: string;
    testPrompt?: string;
  }): Promise<ApiResponse<{ success: boolean; response?: string; error?: string; details?: string; provider?: string; model?: string }>> {
    return this.http.post<any>("/api/config/test-ai", body);
  }

  async testWebhook(body: {
    webhook_url?: string;
    "webhook.method"?: string;
    "webhook.content_type"?: string;
    "webhook.headers"?: string;
    "webhook.body_template"?: string;
    test_message?: string;
  }): Promise<ApiResponse<{ success: boolean; error?: string; details?: string }>> {
    return this.http.post("/api/config/test-webhook", body);
  }
}

/**
 * AI Config API methods (deprecated, use ConfigAPI instead)
 * @deprecated AI config is now part of server config. Use client.config.get('server') and client.config.update('server', {...}) instead.
 */
class AIConfigAPI {
  constructor(private http: HttpClient) {}

  // GET /api/ai-config
  /** @deprecated Use client.config.get('server') instead */
  async get(): Promise<ApiResponse<AIConfig>> {
    return this.http.get<AIConfig>("/api/ai-config");
  }

  // POST /api/ai-config
  /** @deprecated Use client.config.update('server', {...}) instead */
  async update(body: Partial<AIConfig>): Promise<ApiResponse<void>> {
    return this.http.post<void>("/api/ai-config", body);
  }
}

/**
 * Storage API methods
 */
class StorageAPI {
  constructor(private http: HttpClient) {}

  // POST /api/storage
  async upload(file: File, key?: string): Promise<ApiResponse<UploadResponse>> {
    const formData = new FormData();
    formData.append("file", file);
    if (key) formData.append("key", key);
    
    return this.http.post<UploadResponse>("/api/storage", formData);
  }
}

/**
 * Search API methods
 */
class SearchAPI {
  constructor(private http: HttpClient) {}

  // GET /api/search/:keyword
  async search(keyword: string, params?: { page?: number; limit?: number }): Promise<ApiResponse<FeedListResponse>> {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set("page", params.page.toString());
    if (params?.limit) searchParams.set("limit", params.limit.toString());

    const query = searchParams.toString();
    return this.http.get<FeedListResponse>(`/api/search/${encodeURIComponent(keyword)}${query ? `?${query}` : ""}`);
  }
}

/**
 * Auth API methods
 */
class AuthAPI {
  constructor(private http: HttpClient) {}

  // GET /api/auth/status
  async status(): Promise<ApiResponse<AuthStatusResponse>> {
    return this.http.get<AuthStatusResponse>(API_PATHS.AUTH_STATUS);
  }

  // POST /api/auth/login
  async login(body: LoginRequest): Promise<ApiResponse<LoginResponse>> {
    return this.http.post<LoginResponse>(API_PATHS.AUTH_LOGIN, body);
  }

  // POST /api/auth/register/request - 发送注册验证码
  async registerRequest(body: RegisterRequest): Promise<ApiResponse<{
    success: boolean;
    expiresInSeconds: number;
    cooldownSeconds: number;
  }>> {
    return this.http.post(API_PATHS.AUTH_REGISTER_REQUEST, body);
  }

  // POST /api/auth/register/verify - 校验验证码并创建账号
  async registerVerify(body: RegisterVerifyRequest): Promise<ApiResponse<RegisterResponse>> {
    return this.http.post<RegisterResponse>(API_PATHS.AUTH_REGISTER_VERIFY, body);
  }
}

/**
 * WordPress Import API methods
 */
class WordPressAPI {
  constructor(private http: HttpClient) {}

  // POST /api/wp
  async import(xml: string): Promise<ApiResponse<{ imported: number }>> {
    return this.http.post<{ imported: number }>("/api/wp", { xml });
  }
}

/**
 * RSS API methods - direct fetch for RSS feeds
 */
class RSSAPI {
  constructor(private baseUrl: string) {}

  // GET /rss.xml
  async getRSS(): Promise<string> {
    const response = await fetch(`${this.baseUrl}/rss.xml`);
    return response.text();
  }

  // GET /atom.xml
  async getAtom(): Promise<string> {
    const response = await fetch(`${this.baseUrl}/atom.xml`);
    return response.text();
  }

  // GET /rss.json
  async getJSON(): Promise<unknown> {
    const response = await fetch(`${this.baseUrl}/rss.json`);
    return response.json();
  }
}

// ============================================================================
// Main API Client Class
// ============================================================================

export class ApiClient {
  private http: HttpClient;
  feed: FeedAPI;
  tag: TagAPI;
  comment: CommentAPI;
  user: UserAPI;
  friend: FriendAPI;
  moments: MomentsAPI;
  config: ConfigAPI;
  aiConfig: AIConfigAPI;
  storage: StorageAPI;
  search: SearchAPI;
  auth: AuthAPI;
  wp: WordPressAPI;
  rss: RSSAPI;
  adminUser: AdminUserAPI;
  adminPlugin: AdminPluginAPI;
  adminFeeds: AdminFeedsAPI;

  constructor(baseUrl: string) {
    this.http = new HttpClient(baseUrl);
    this.feed = new FeedAPI(this.http);
    this.tag = new TagAPI(this.http);
    this.comment = new CommentAPI(this.http);
    this.user = new UserAPI(this.http);
    this.adminUser = new AdminUserAPI(this.http);
    this.adminPlugin = new AdminPluginAPI(this.http);
    this.adminFeeds = new AdminFeedsAPI(this.http);
    this.friend = new FriendAPI(this.http);
    this.moments = new MomentsAPI(this.http);
    this.config = new ConfigAPI(this.http);
    this.aiConfig = new AIConfigAPI(this.http);
    this.storage = new StorageAPI(this.http);
    this.search = new SearchAPI(this.http);
    this.auth = new AuthAPI(this.http);
    this.wp = new WordPressAPI(this.http);
    this.rss = new RSSAPI(baseUrl);
  }
}

// ============================================================================
// Factory Function (Eden-compatible interface)
// ============================================================================

export function createClient(baseUrl: string): ApiClient {
  return new ApiClient(baseUrl);
}

// Default export
export default ApiClient;
