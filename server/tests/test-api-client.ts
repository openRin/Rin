import type {
  ApiResponse,
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
 * Test API Client for Server-side Integration Tests
 * 
 * This client wraps the app.handle() method to provide type-safe API calls
 * that match the client-side API interface, ensuring consistency between
 * client and server tests.
 */

export interface TestAPIOptions {
  headers?: Record<string, string>;
  userId?: string;
  isAdmin?: boolean;
  token?: string;
}

export class TestAPIClient {
  constructor(
    private app: any,
    private env: Env,
    private baseUrl: string = 'http://localhost'
  ) {}

  private async request<T>(
    method: string,
    path: string,
    body?: any,
    options?: TestAPIOptions
  ): Promise<ApiResponse<T>> {
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      ...options?.headers,
    };

    if (options?.userId) {
      headers['X-User-Id'] = options.userId;
    }

    if (options?.isAdmin) {
      headers['X-Admin'] = 'true';
    }

    if (options?.token) {
      headers['Authorization'] = `Bearer ${options.token}`;
    }

    if (body !== undefined && !(body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    const request = new Request(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body !== undefined ? (body instanceof FormData ? body : JSON.stringify(body)) : undefined,
    });

    try {
      const response = await this.app.handle(request, this.env);
      
      if (!response.ok) {
        const contentType = response.headers.get('content-type');
        let errorValue: any;
        
        if (contentType?.includes('application/json')) {
          try {
            errorValue = await response.json();
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

  async get<T>(path: string, options?: TestAPIOptions): Promise<ApiResponse<T>> {
    return this.request<T>('GET', path, undefined, options);
  }

  async post<T>(path: string, body?: any, options?: TestAPIOptions): Promise<ApiResponse<T>> {
    return this.request<T>('POST', path, body, options);
  }

  async put<T>(path: string, body?: any, options?: TestAPIOptions): Promise<ApiResponse<T>> {
    return this.request<T>('PUT', path, body, options);
  }

  async patch<T>(path: string, body?: any, options?: TestAPIOptions): Promise<ApiResponse<T>> {
    return this.request<T>('PATCH', path, body, options);
  }

  async delete<T>(path: string, options?: TestAPIOptions): Promise<ApiResponse<T>> {
    return this.request<T>('DELETE', path, undefined, options);
  }

  // Feed API
  feed = {
    list: async (
      params?: { page?: number; limit?: number; type?: 'draft' | 'unlisted' | 'normal' },
      options?: TestAPIOptions
    ): Promise<ApiResponse<FeedListResponse>> => {
      const searchParams = new URLSearchParams();
      if (params?.page) searchParams.set('page', params.page.toString());
      if (params?.limit) searchParams.set('limit', params.limit.toString());
      if (params?.type) searchParams.set('type', params.type);
      
      const query = searchParams.toString();
      return this.get<FeedListResponse>(`/feed${query ? `?${query}` : ''}`, options);
    },

    timeline: async (options?: TestAPIOptions): Promise<ApiResponse<TimelineItem[]>> => {
      return this.get<TimelineItem[]>('/feed/timeline', options);
    },

    get: async (id: number | string, options?: TestAPIOptions): Promise<ApiResponse<Feed>> => {
      return this.get<Feed>(`/feed/${id}`, options);
    },

    create: async (
      body: CreateFeedRequest,
      options?: TestAPIOptions
    ): Promise<ApiResponse<{ insertedId: number }>> => {
      return this.post<{ insertedId: number }>('/feed', body, options);
    },

    update: async (
      id: number,
      body: UpdateFeedRequest,
      options?: TestAPIOptions
    ): Promise<ApiResponse<void>> => {
      return this.post<void>(`/feed/${id}`, body, options);
    },

    delete: async (id: number, options?: TestAPIOptions): Promise<ApiResponse<void>> => {
      return this.delete<void>(`/feed/${id}`, options);
    },

    adjacent: async (
      id: number | string,
      options?: TestAPIOptions
    ): Promise<ApiResponse<{ prev: Feed | null; next: Feed | null }>> => {
      return this.get<{ prev: Feed | null; next: Feed | null }>(`/feed/adjacent/${id}`, options);
    },

    setTop: async (
      id: number,
      top: number,
      options?: TestAPIOptions
    ): Promise<ApiResponse<void>> => {
      return this.post<void>(`/feed/top/${id}`, { top }, options);
    },
  };

  // Auth API
  auth = {
    status: async (options?: TestAPIOptions): Promise<ApiResponse<AuthStatus>> => {
      return this.get<AuthStatus>('/auth/status', options);
    },

    login: async (
      body: LoginRequest,
      options?: TestAPIOptions
    ): Promise<ApiResponse<LoginResponse>> => {
      return this.post<LoginResponse>('/auth/login', body, options);
    },
  };

  // User API
  user = {
    profile: async (options?: TestAPIOptions): Promise<ApiResponse<UserProfile>> => {
      return this.get<UserProfile>('/user/profile', options);
    },

    updateProfile: async (
      body: UpdateProfileRequest,
      options?: TestAPIOptions
    ): Promise<ApiResponse<{ success: boolean }>> => {
      return this.put<{ success: boolean }>('/user/profile', body, options);
    },

    logout: async (options?: TestAPIOptions): Promise<ApiResponse<void>> => {
      return this.post<void>('/user/logout', undefined, options);
    },
  };

  // Tag API
  tag = {
    list: async (options?: TestAPIOptions): Promise<ApiResponse<Tag[]>> => {
      return this.get<Tag[]>('/tag', options);
    },

    get: async (name: string, options?: TestAPIOptions): Promise<ApiResponse<TagDetail>> => {
      return this.get<TagDetail>(`/tag/${encodeURIComponent(name)}`, options);
    },
  };

  // Comment API
  comment = {
    list: async (feedId: number, options?: TestAPIOptions): Promise<ApiResponse<Comment[]>> => {
      return this.get<Comment[]>(`/comment/${feedId}`, options);
    },

    create: async (
      feedId: number,
      body: CreateCommentRequest,
      options?: TestAPIOptions
    ): Promise<ApiResponse<Comment>> => {
      return this.post<Comment>(`/comment/${feedId}`, body, options);
    },

    delete: async (id: number, options?: TestAPIOptions): Promise<ApiResponse<void>> => {
      return this.delete<void>(`/comment/${id}`, options);
    },
  };

  // Friend API
  friend = {
    list: async (options?: TestAPIOptions): Promise<ApiResponse<FriendListResponse>> => {
      return this.get<FriendListResponse>('/friend', options);
    },

    create: async (
      body: CreateFriendRequest,
      options?: TestAPIOptions
    ): Promise<ApiResponse<Friend>> => {
      return this.post<Friend>('/friend', body, options);
    },

    update: async (
      id: number,
      body: UpdateFriendRequest,
      options?: TestAPIOptions
    ): Promise<ApiResponse<Friend>> => {
      return this.put<Friend>(`/friend/${id}`, body, options);
    },

    delete: async (id: number, options?: TestAPIOptions): Promise<ApiResponse<void>> => {
      return this.delete<void>(`/friend/${id}`, options);
    },
  };

  // Moment API
  moments = {
    list: async (
      params?: { page?: number; limit?: number },
      options?: TestAPIOptions
    ): Promise<ApiResponse<{ data: Moment[]; hasNext: boolean }>> => {
      const searchParams = new URLSearchParams();
      if (params?.page) searchParams.set('page', params.page.toString());
      if (params?.limit) searchParams.set('limit', params.limit.toString());
      
      const query = searchParams.toString();
      return this.get<{ data: Moment[]; hasNext: boolean }>(`/moments${query ? `?${query}` : ''}`, options);
    },

    create: async (
      body: CreateMomentRequest,
      options?: TestAPIOptions
    ): Promise<ApiResponse<Moment>> => {
      return this.post<Moment>('/moments', body, options);
    },

    update: async (
      id: number,
      body: CreateMomentRequest,
      options?: TestAPIOptions
    ): Promise<ApiResponse<Moment>> => {
      return this.post<Moment>(`/moments/${id}`, body, options);
    },

    delete: async (id: number, options?: TestAPIOptions): Promise<ApiResponse<void>> => {
      return this.delete<void>(`/moments/${id}`, options);
    },
  };

  // Config API
  config = {
    get: async (type: ConfigType, options?: TestAPIOptions): Promise<ApiResponse<ConfigResponse>> => {
      return this.get<ConfigResponse>(`/config/${type}`, options);
    },

    update: async (
      type: ConfigType,
      body: Record<string, any>,
      options?: TestAPIOptions
    ): Promise<ApiResponse<void>> => {
      return this.post<void>(`/config/${type}`, body, options);
    },

    clearCache: async (options?: TestAPIOptions): Promise<ApiResponse<void>> => {
      return this.delete<void>('/config/cache', options);
    },
  };

  // AI Config API
  aiConfig = {
    get: async (options?: TestAPIOptions): Promise<ApiResponse<AIConfig>> => {
      return this.get<AIConfig>('/ai-config', options);
    },

    update: async (
      body: Partial<AIConfig>,
      options?: TestAPIOptions
    ): Promise<ApiResponse<void>> => {
      return this.post<void>('/ai-config', body, options);
    },
  };

  // Storage API
  storage = {
    upload: async (
      file: File,
      key?: string,
      options?: TestAPIOptions
    ): Promise<ApiResponse<UploadResponse>> => {
      const formData = new FormData();
      formData.append('file', file);
      if (key) formData.append('key', key);
      
      return this.post<UploadResponse>('/storage', formData, options);
    },
  };

  // Search API
  search = {
    search: async (
      keyword: string,
      options?: TestAPIOptions
    ): Promise<ApiResponse<FeedListResponse>> => {
      return this.get<FeedListResponse>(`/search/${encodeURIComponent(keyword)}`, options);
    },
  };

  // WordPress Import API
  wp = {
    import: async (
      xmlContent: string,
      options?: TestAPIOptions
    ): Promise<ApiResponse<{ imported: number }>> => {
      return this.post<{ imported: number }>('/wp', { xml: xmlContent }, options);
    },
  };
}

/**
 * Factory function to create a test API client
 * Mirrors the client-side createClient function for consistency
 */
export function createTestClient(app: any, env: Env, baseUrl?: string): TestAPIClient {
  return new TestAPIClient(app, env, baseUrl);
}

export default TestAPIClient;
