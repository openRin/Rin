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
  AuthStatus,
  LoginRequest,
  LoginResponse,
} from "@rin/api";

// Re-export for external use
export type {
  ApiResponse,
  RequestOptions,
  Feed,
  FeedListResponse,
  TimelineItem,
  CreateFeedRequest,
  UpdateFeedRequest,
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
  AuthStatus,
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
        try {
          errorValue = await response.json();
        } catch {
          errorValue = await response.text();
        }
        return {
          error: {
            status: response.status,
            value: typeof errorValue === 'string' ? errorValue : String(errorValue ?? response.statusText),
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
  async create(body: CreateFeedRequest): Promise<ApiResponse<{ insertedId: number }>> {
    return this.http.post<{ insertedId: number }>("/api/feed", body);
  }

  // POST /api/feed/:id
  async update(id: number, body: UpdateFeedRequest): Promise<ApiResponse<void>> {
    return this.http.post<void>(`/api/feed/${id}`, body);
  }

  // DELETE /api/feed/:id
  async delete(id: number): Promise<ApiResponse<void>> {
    return this.http.delete<void>(`/api/feed/${id}`);
  }

  // GET /api/feed/adjacent/:id
  async adjacent(id: number | string): Promise<ApiResponse<{ prev: Feed | null; next: Feed | null }>> {
    return this.http.get<{ prev: Feed | null; next: Feed | null }>(`/api/feed/adjacent/${id}`);
  }

  // POST /api/feed/top/:id
  async setTop(id: number, top: number): Promise<ApiResponse<void>> {
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
  async list(feedId: number): Promise<ApiResponse<Comment[]>> {
    return this.http.get<Comment[]>(`/api/comment/${feedId}`);
  }

  // POST /api/comment/:feed
  async create(feedId: number, body: CreateCommentRequest): Promise<ApiResponse<Comment>> {
    return this.http.post<Comment>(`/api/comment/${feedId}`, body);
  }

  // DELETE /api/comment/:id
  async delete(id: number): Promise<ApiResponse<void>> {
    return this.http.delete<void>(`/api/comment/${id}`);
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

  // GET /api/config/:type
  async get(type: ConfigType): Promise<ApiResponse<ConfigResponse>> {
    return this.http.get<ConfigResponse>(`/api/config/${type}`);
  }

  // POST /api/config/:type
  async update(type: ConfigType, body: Record<string, unknown>): Promise<ApiResponse<void>> {
    return this.http.post<void>(`/api/config/${type}`, body);
  }

  // DELETE /api/config/cache
  async clearCache(): Promise<ApiResponse<void>> {
    return this.http.delete<void>("/api/config/cache");
  }
}

/**
 * AI Config API methods
 */
class AIConfigAPI {
  constructor(private http: HttpClient) {}

  // GET /api/ai-config
  async get(): Promise<ApiResponse<AIConfig>> {
    return this.http.get<AIConfig>("/api/ai-config");
  }

  // POST /api/ai-config
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
  async search(keyword: string): Promise<ApiResponse<FeedListResponse>> {
    return this.http.get<FeedListResponse>(`/api/search/${encodeURIComponent(keyword)}`);
  }
}

/**
 * Auth API methods
 */
class AuthAPI {
  constructor(private http: HttpClient) {}

  // GET /api/auth/status
  async status(): Promise<ApiResponse<AuthStatus>> {
    return this.http.get<AuthStatus>("/api/auth/status");
  }

  // POST /api/auth/login
  async login(body: LoginRequest): Promise<ApiResponse<LoginResponse>> {
    return this.http.post<LoginResponse>("/api/auth/login", body);
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

/**
 * SEO API methods
 */
class SEOAPI {
  constructor(private baseUrl: string) {}

  // GET /robots.txt
  async getRobots(): Promise<string> {
    const response = await fetch(`${this.baseUrl}/robots.txt`);
    return response.text();
  }

  // GET /sitemap.xml
  async getSitemap(): Promise<string> {
    const response = await fetch(`${this.baseUrl}/sitemap.xml`);
    return response.text();
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
  seo: SEOAPI;

  constructor(baseUrl: string) {
    this.http = new HttpClient(baseUrl);
    this.feed = new FeedAPI(this.http);
    this.tag = new TagAPI(this.http);
    this.comment = new CommentAPI(this.http);
    this.user = new UserAPI(this.http);
    this.friend = new FriendAPI(this.http);
    this.moments = new MomentsAPI(this.http);
    this.config = new ConfigAPI(this.http);
    this.aiConfig = new AIConfigAPI(this.http);
    this.storage = new StorageAPI(this.http);
    this.search = new SearchAPI(this.http);
    this.auth = new AuthAPI(this.http);
    this.wp = new WordPressAPI(this.http);
    this.rss = new RSSAPI(baseUrl);
    this.seo = new SEOAPI(baseUrl);
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
