// API Client for Rin - Type-safe HTTP client to replace Eden
// This client provides a clean, type-safe interface for all backend API endpoints

import { endpoint } from "../main";

// ============================================================================
// Types
// ============================================================================

export interface ApiResponse<T> {
  data?: T;
  error?: {
    status: number;
    value: string;
  };
}

export interface RequestOptions {
  headers?: Record<string, string>;
}

// Feed types
export interface Feed {
  id: number;
  title: string | null;
  content: string;
  uid: number;
  createdAt: string;
  updatedAt: string;
  ai_summary: string;
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
    id: number;
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
  id: number;
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
  listed?: boolean;
  draft?: boolean;
  createdAt?: string;
  tags?: string[];
  top?: number;
}

// User types
export interface UserProfile {
  id: number;
  username: string;
  avatar: string | null;
  permission: number;
}

// Tag types
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

// Comment types
export interface Comment {
  id: number;
  content: string;
  createdAt: string;
  updatedAt: string;
  user: {
    id: number;
    username: string;
    avatar: string | null;
    permission: number | null;
  };
}

export interface CreateCommentRequest {
  content: string;
}

// Friend types
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
  name?: string;
  desc?: string;
  avatar?: string;
  url?: string;
  accepted?: number;
  sort_order?: number;
}

// Moment types
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

// Config types
export type ConfigType = 'client' | 'server';

export interface ConfigResponse {
  [key: string]: any;
}

// AI Config types
export interface AIConfig {
  enabled: boolean;
  provider: string;
  model: string;
  api_key: string;
  api_url: string;
}

// Storage types
export interface UploadResponse {
  url: string;
}

// ============================================================================
// Base HTTP Client
// ============================================================================

class HttpClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  private async request<T>(
    method: string,
    path: string,
    body?: any,
    options?: RequestOptions
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${path}`;
    
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      ...options?.headers,
    };

    const init: RequestInit = {
      method,
      headers,
      credentials: 'include',
    };

    if (body !== undefined) {
      if (body instanceof FormData) {
        // Don't set Content-Type for FormData - browser will set it with boundary
        delete headers['Content-Type'];
        init.body = body;
      } else {
        headers['Content-Type'] = 'application/json';
        init.body = JSON.stringify(body);
      }
    }

    try {
      const response = await fetch(url, init);
      
      if (!response.ok) {
        const contentType = response.headers.get('content-type');
        let errorValue: any;
        
        if (contentType?.includes('application/json')) {
          // Try to parse structured error response
          try {
            const errorData = await response.json();
            errorValue = errorData;
          } catch {
            errorValue = await response.text();
          }
        } else {
          errorValue = await response.text();
        }
        
        return {
          error: {
            status: response.status,
            value: errorValue || response.statusText,
          },
        };
      }

      // Handle empty responses
      const contentLength = response.headers.get('content-length');
      if (contentLength === '0' || response.status === 204) {
        return { data: undefined as T };
      }

      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        const data = await response.json();
        return { data };
      }

      const text = await response.text();
      return { data: text as T };
    } catch (error) {
      return {
        error: {
          status: 0,
          value: error instanceof Error ? error.message : 'Network error',
        },
      };
    }
  }

  async get<T>(path: string, options?: RequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>('GET', path, undefined, options);
  }

  async post<T>(path: string, body?: any, options?: RequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>('POST', path, body, options);
  }

  async put<T>(path: string, body?: any, options?: RequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>('PUT', path, body, options);
  }

  async patch<T>(path: string, body?: any, options?: RequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>('PATCH', path, body, options);
  }

  async delete<T>(path: string, options?: RequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>('DELETE', path, undefined, options);
  }
}

// ============================================================================
// API Services
// ============================================================================

class FeedAPI {
  constructor(private client: HttpClient) {}

  // GET /feed
  async list(
    params?: { page?: number; limit?: number; type?: 'draft' | 'unlisted' | 'normal' },
    options?: RequestOptions
  ): Promise<ApiResponse<FeedListResponse>> {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    if (params?.type) searchParams.set('type', params.type);
    
    const query = searchParams.toString();
    return this.client.get<FeedListResponse>(`/feed${query ? `?${query}` : ''}`, options);
  }

  // GET /feed/timeline
  async timeline(options?: RequestOptions): Promise<ApiResponse<TimelineItem[]>> {
    return this.client.get<TimelineItem[]>('/feed/timeline', options);
  }

  // GET /feed/:id
  async get(id: number | string, options?: RequestOptions): Promise<ApiResponse<Feed>> {
    return this.client.get<Feed>(`/feed/${id}`, options);
  }

  // POST /feed
  async create(body: CreateFeedRequest, options?: RequestOptions): Promise<ApiResponse<{ insertedId: number }>> {
    return this.client.post<{ insertedId: number }>('/feed', body, options);
  }

  // POST /feed/:id
  async update(id: number, body: UpdateFeedRequest, options?: RequestOptions): Promise<ApiResponse<void>> {
    return this.client.post<void>(`/feed/${id}`, body, options);
  }

  // DELETE /feed/:id
  async delete(id: number, options?: RequestOptions): Promise<ApiResponse<void>> {
    return this.client.delete<void>(`/feed/${id}`, options);
  }

  // GET /feed/adjacent/:id
  async adjacent(id: number | string, options?: RequestOptions): Promise<ApiResponse<{ prev: Feed | null; next: Feed | null }>> {
    return this.client.get<{ prev: Feed | null; next: Feed | null }>(`/feed/adjacent/${id}`, options);
  }

  // POST /feed/top/:id
  async setTop(id: number, top: number, options?: RequestOptions): Promise<ApiResponse<void>> {
    return this.client.post<void>(`/feed/top/${id}`, { top }, options);
  }
}

class UserAPI {
  constructor(private client: HttpClient) {}

  // GET /user/profile
  async profile(options?: RequestOptions): Promise<ApiResponse<UserProfile>> {
    return this.client.get<UserProfile>('/user/profile', options);
  }

  // POST /user/logout
  async logout(options?: RequestOptions): Promise<ApiResponse<void>> {
    return this.client.post<void>('/user/logout', undefined, options);
  }

  // GET /user/github
  githubAuth(): string {
    return `${endpoint}/user/github`;
  }
}

class TagAPI {
  constructor(private client: HttpClient) {}

  // GET /tag
  async list(options?: RequestOptions): Promise<ApiResponse<Tag[]>> {
    return this.client.get<Tag[]>('/tag', options);
  }

  // GET /tag/:name
  async get(name: string, options?: RequestOptions): Promise<ApiResponse<TagDetail>> {
    return this.client.get<TagDetail>(`/tag/${encodeURIComponent(name)}`, options);
  }
}

class CommentAPI {
  constructor(private client: HttpClient) {}

  // GET /feed/comment/:feed
  async list(feedId: number, options?: RequestOptions): Promise<ApiResponse<Comment[]>> {
    return this.client.get<Comment[]>(`/feed/comment/${feedId}`, options);
  }

  // POST /feed/comment/:feed
  async create(feedId: number, body: CreateCommentRequest, options?: RequestOptions): Promise<ApiResponse<Comment>> {
    return this.client.post<Comment>(`/feed/comment/${feedId}`, body, options);
  }

  // DELETE /comment/:id
  async delete(id: number, options?: RequestOptions): Promise<ApiResponse<void>> {
    return this.client.delete<void>(`/comment/${id}`, options);
  }
}

class FriendAPI {
  constructor(private client: HttpClient) {}

  // GET /friend
  async list(options?: RequestOptions): Promise<ApiResponse<FriendListResponse>> {
    return this.client.get<FriendListResponse>('/friend', options);
  }

  // POST /friend
  async create(body: CreateFriendRequest, options?: RequestOptions): Promise<ApiResponse<Friend>> {
    return this.client.post<Friend>('/friend', body, options);
  }

  // PUT /friend/:id
  async update(id: number, body: UpdateFriendRequest, options?: RequestOptions): Promise<ApiResponse<Friend>> {
    return this.client.put<Friend>(`/friend/${id}`, body, options);
  }

  // DELETE /friend/:id
  async delete(id: number, options?: RequestOptions): Promise<ApiResponse<void>> {
    return this.client.delete<void>(`/friend/${id}`, options);
  }
}

class MomentAPI {
  constructor(private client: HttpClient) {}

  // GET /moments
  async list(params?: { page?: number; limit?: number }, options?: RequestOptions): Promise<ApiResponse<{ data: Moment[]; hasNext: boolean }>> {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    
    const query = searchParams.toString();
    return this.client.get<{ data: Moment[]; hasNext: boolean }>(`/moments${query ? `?${query}` : ''}`, options);
  }

  // POST /moments
  async create(body: CreateMomentRequest, options?: RequestOptions): Promise<ApiResponse<Moment>> {
    return this.client.post<Moment>('/moments', body, options);
  }

  // POST /moments/:id
  async update(id: number, body: CreateMomentRequest, options?: RequestOptions): Promise<ApiResponse<Moment>> {
    return this.client.post<Moment>(`/moments/${id}`, body, options);
  }

  // DELETE /moments/:id
  async delete(id: number, options?: RequestOptions): Promise<ApiResponse<void>> {
    return this.client.delete<void>(`/moments/${id}`, options);
  }
}

class ConfigAPI {
  constructor(private client: HttpClient) {}

  // GET /config/:type
  async get(type: ConfigType, options?: RequestOptions): Promise<ApiResponse<ConfigResponse>> {
    return this.client.get<ConfigResponse>(`/config/${type}`, options);
  }

  // POST /config/:type
  async update(type: ConfigType, body: Record<string, any>, options?: RequestOptions): Promise<ApiResponse<void>> {
    return this.client.post<void>(`/config/${type}`, body, options);
  }

  // DELETE /config/cache
  async clearCache(options?: RequestOptions): Promise<ApiResponse<void>> {
    return this.client.delete<void>('/config/cache', options);
  }
}

class AIConfigAPI {
  constructor(private client: HttpClient) {}

  // GET /ai-config
  async get(options?: RequestOptions): Promise<ApiResponse<AIConfig>> {
    return this.client.get<AIConfig>('/ai-config', options);
  }

  // POST /ai-config
  async update(body: Partial<AIConfig>, options?: RequestOptions): Promise<ApiResponse<void>> {
    return this.client.post<void>('/ai-config', body, options);
  }
}

class StorageAPI {
  constructor(private client: HttpClient) {}

  // POST /storage
  async upload(file: File, key?: string, options?: RequestOptions): Promise<ApiResponse<UploadResponse>> {
    const formData = new FormData();
    formData.append('file', file);
    if (key) formData.append('key', key);
    
    return this.client.post<UploadResponse>('/storage', formData, options);
  }
}

class FaviconAPI {
  constructor(private client: HttpClient) {}

  // GET /favicon
  async get(options?: RequestOptions): Promise<ApiResponse<Blob>> {
    const response = await fetch(`${endpoint}/favicon`, {
      ...options,
      credentials: 'include',
    });
    
    if (!response.ok) {
      return {
        error: {
          status: response.status,
          value: response.statusText,
        },
      };
    }
    
    return { data: await response.blob() };
  }

  // GET /favicon/original
  async getOriginal(options?: RequestOptions): Promise<ApiResponse<Blob>> {
    const response = await fetch(`${endpoint}/favicon/original`, {
      ...options,
      credentials: 'include',
    });
    
    if (!response.ok) {
      return {
        error: {
          status: response.status,
          value: response.statusText,
        },
      };
    }
    
    return { data: await response.blob() };
  }

  // POST /favicon
  async upload(file: File, options?: RequestOptions): Promise<ApiResponse<void>> {
    const formData = new FormData();
    formData.append('file', file);
    
    return this.client.post<void>('/favicon', formData, options);
  }
}

class SearchAPI {
  constructor(private client: HttpClient) {}

  // GET /search/:keyword
  async search(keyword: string, options?: RequestOptions): Promise<ApiResponse<FeedListResponse>> {
    return this.client.get<FeedListResponse>(`/search/${encodeURIComponent(keyword)}`, options);
  }
}

class WordPressAPI {
  constructor(private client: HttpClient) {}

  // POST /wp
  async import(xmlContent: string, options?: RequestOptions): Promise<ApiResponse<{ imported: number }>> {
    return this.client.post<{ imported: number }>('/wp', { xml: xmlContent }, options);
  }
}

class RSSAPI {
  constructor(private baseUrl: string) {}

  // GET /sub/:name
  getUrl(name: string): string {
    return `${this.baseUrl}/sub/${encodeURIComponent(name)}`;
  }
}

class SEOAPI {
  constructor(private baseUrl: string) {}

  // GET /seo/*
  getUrl(path: string): string {
    return `${this.baseUrl}/seo${path}`;
  }
}

// ============================================================================
// Main API Client
// ============================================================================

export class ApiClient {
  private http: HttpClient;
  
  public feed: FeedAPI;
  public user: UserAPI;
  public tag: TagAPI;
  public comment: CommentAPI;
  public friend: FriendAPI;
  public moments: MomentAPI;
  public config: ConfigAPI;
  public aiConfig: AIConfigAPI;
  public storage: StorageAPI;
  public favicon: FaviconAPI;
  public search: SearchAPI;
  public wp: WordPressAPI;
  public rss: RSSAPI;
  public seo: SEOAPI;

  constructor(baseUrl: string) {
    this.http = new HttpClient(baseUrl);
    
    this.feed = new FeedAPI(this.http);
    this.user = new UserAPI(this.http);
    this.tag = new TagAPI(this.http);
    this.comment = new CommentAPI(this.http);
    this.friend = new FriendAPI(this.http);
    this.moments = new MomentAPI(this.http);
    this.config = new ConfigAPI(this.http);
    this.aiConfig = new AIConfigAPI(this.http);
    this.storage = new StorageAPI(this.http);
    this.favicon = new FaviconAPI(this.http);
    this.search = new SearchAPI(this.http);
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
