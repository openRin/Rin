// ============================================================================
// Shared API Types - Used by both client and server
// ============================================================================

// Common types
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

// ============================================================================
// Feed Types
// ============================================================================

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
  listed: boolean;
  draft?: boolean;
  createdAt?: string;
  tags?: string[];
  top?: number;
}

export interface AdjacentFeed {
  id: number;
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

// ============================================================================
// User Types
// ============================================================================

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

// ============================================================================
// Auth Types
// ============================================================================

export interface AuthStatus {
  github: boolean;
  password: boolean;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  token?: string;
  user: UserProfile;
}

// ============================================================================
// Tag Types
// ============================================================================

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

// ============================================================================
// Comment Types
// ============================================================================

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

// ============================================================================
// Friend Types
// ============================================================================

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

// ============================================================================
// Moment Types
// ============================================================================

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

// ============================================================================
// Config Types
// ============================================================================

export type ConfigType = 'client' | 'server';

export interface ConfigResponse {
  [key: string]: any;
}

// ============================================================================
// AI Config Types
// ============================================================================

export interface AIConfig {
  enabled: boolean;
  provider: string;
  model: string;
  api_key: string;
  api_url: string;
}

// ============================================================================
// Storage Types
// ============================================================================

export interface UploadResponse {
  url: string;
}

// ============================================================================
// Search Types
// ============================================================================

// Uses FeedListResponse

// ============================================================================
// WordPress Import Types
// ============================================================================

export interface WordPressImportResponse {
  success: number;
  skipped: number;
  skippedList: Array<{ title: string; reason: string }>;
}

// ============================================================================
// API Endpoint Paths
// ============================================================================

export const API_PATHS = {
  // Feed
  FEED_LIST: '/api/feed',
  FEED_TIMELINE: '/api/feed/timeline',
  FEED_GET: (id: number | string) => `/api/feed/${id}`,
  FEED_CREATE: '/api/feed',
  FEED_UPDATE: (id: number) => `/api/feed/${id}`,
  FEED_DELETE: (id: number) => `/api/feed/${id}`,
  FEED_ADJACENT: (id: number | string) => `/api/feed/adjacent/${id}`,
  FEED_SET_TOP: (id: number) => `/api/feed/top/${id}`,

  // Auth
  AUTH_STATUS: '/api/auth/status',
  AUTH_LOGIN: '/api/auth/login',

  // User
  USER_PROFILE: '/api/user/profile',
  USER_UPDATE_PROFILE: '/api/user/profile',
  USER_LOGOUT: '/api/user/logout',
  USER_GITHUB: '/api/user/github',

  // Tag
  TAG_LIST: '/api/tag',
  TAG_GET: (name: string) => `/api/tag/${encodeURIComponent(name)}`,

  // Comment
  COMMENT_LIST: (feedId: number) => `/api/comment/${feedId}`,
  COMMENT_CREATE: (feedId: number) => `/api/comment/${feedId}`,
  COMMENT_DELETE: (id: number) => `/api/comment/${id}`,

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

  // AI Config
  AI_CONFIG_GET: '/ai-config',
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

  // SEO
  SEO_GET: (path: string) => `/seo${path}`,
} as const;

export type APIEndpoint = typeof API_PATHS;
