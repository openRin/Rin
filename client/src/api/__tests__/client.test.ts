import { beforeEach, describe, expect, it, mock } from 'bun:test'
import type { Comment, Feed, FeedListResponse, LoginResponse, Tag, TagDetail } from '@rin/api'
import { createClient } from '../client'

const api = createClient('http://localhost')

// Mock fetch globally
const mockFetch = mock()
global.fetch = mockFetch

const timestamp = '2026-01-01T00:00:00.000Z'

const createFeed = (id: number, title: string): Feed => ({
  id,
  title,
  content: `Content ${id}`,
  uid: 1,
  createdAt: timestamp,
  updatedAt: timestamp,
  ai_summary: '',
  ai_summary_status: 'idle',
  ai_summary_error: '',
  hashtags: [],
  user: {
    avatar: null,
    id: 1,
    username: 'testuser',
  },
  pv: 0,
  uv: 0,
})

const createComment = (id: number, content: string): Comment => ({
  id,
  content,
  createdAt: timestamp,
  updatedAt: timestamp,
  user: {
    id,
    username: `user${id}`,
    avatar: null,
    permission: 0,
  },
  approved: true,
})

describe('API Client', () => {
  beforeEach(() => {
    mockFetch.mockClear()
  })

  // Helper to create mock response with clone method
  const createMockResponse = <T extends object>(response: T) => {
    return {
      ...response,
      clone() {
        return this
      },
    }
  }

  describe('Feed API', () => {
    it('should fetch feed list', async () => {
      const mockResponse: FeedListResponse = {
        size: 2,
        data: [
          {
            id: 1,
            title: 'Feed 1',
            summary: 'Summary 1',
            hashtags: [],
            user: { avatar: null, id: 1, username: 'testuser' },
            avatar: null,
            createdAt: timestamp,
            updatedAt: timestamp,
            pv: 0,
            uv: 0,
          },
          {
            id: 2,
            title: 'Feed 2',
            summary: 'Summary 2',
            hashtags: [],
            user: { avatar: null, id: 1, username: 'testuser' },
            avatar: null,
            createdAt: timestamp,
            updatedAt: timestamp,
            pv: 0,
            uv: 0,
          },
        ],
        hasNext: false,
      }

      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => mockResponse,
      }))

      const result = await api.feed.list({ page: 1, limit: 10 })

      expect(result.data).toEqual(mockResponse)
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/feed?page=1&limit=10'),
        expect.any(Object)
      )
    })

    it('should handle feed list error', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        headers: new Map(),
        json: async () => ({ error: 'Server error' }),
      }))

      const result = await api.feed.list({ page: 1 })

      expect(result.error).toBeDefined()
      expect(result.error?.status).toBe(500)
    })

    it('should fetch single feed', async () => {
      const mockResponse = createFeed(1, 'Feed 1')

      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => mockResponse,
      }))

      const result = await api.feed.get(1)

      expect(result.data).toEqual(mockResponse)
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost/api/feed/1',
        expect.any(Object)
      )
    })

    it('should create feed', async () => {
      const mockResponse = { insertedId: 123 }
      const feedData = {
        title: 'New Feed',
        content: 'Content',
        listed: true,
        draft: false,
        tags: [],
      }

      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => mockResponse,
      }))

      const result = await api.feed.create(feedData)

      expect(result.data).toEqual(mockResponse)
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost/api/feed',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(feedData),
        })
      )
    })
  })

  describe('Tag API', () => {
    it('should fetch all tags', async () => {
      const mockResponse: Tag[] = [
        { id: 1, name: 'tag1', count: 5, createdAt: timestamp, updatedAt: timestamp },
        { id: 2, name: 'tag2', count: 3, createdAt: timestamp, updatedAt: timestamp },
      ]

      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => mockResponse,
      }))

      const result = await api.tag.list()

      expect(result.data).toEqual(mockResponse)
    })

    it('should fetch tag by name', async () => {
      const mockResponse: TagDetail = {
        id: 1,
        name: 'tag1',
        count: 1,
        createdAt: timestamp,
        updatedAt: timestamp,
        feeds: [createFeed(1, 'Feed 1')],
      }

      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => mockResponse,
      }))

      const result = await api.tag.get('tag1')

      expect(result.data).toEqual(mockResponse)
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost/api/tag/tag1',
        expect.any(Object)
      )
    })
  })

  describe('Comment API', () => {
    it('should fetch comments for feed', async () => {
      const mockResponse: Comment[] = [
        createComment(1, 'Comment 1'),
        createComment(2, 'Comment 2'),
      ]

      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => mockResponse,
      }))

      const result = await api.comment.list(1)

      expect(result.data).toEqual(mockResponse)
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost/api/comment/1',
        expect.any(Object)
      )
    })

    it('should create comment', async () => {
      const mockResponse = createComment(1, 'New comment')
      const commentData = { content: 'New comment' }

      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => mockResponse,
      }))

      const result = await api.comment.create(1, commentData)

      expect(result.data).toEqual(mockResponse)
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost/api/comment/1',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(commentData),
        })
      )
    })
  })

  describe('User API', () => {
    it('should fetch user profile', async () => {
      const mockResponse = {
        id: 1,
        username: 'testuser',
        avatar: 'avatar.png',
        permission: false,
      }

      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => mockResponse,
      }))

      const result = await api.user.profile()

      expect(result.data).toEqual(mockResponse)
    })

    it('should update profile', async () => {
      const mockResponse = { success: true }
      const profileData = { username: 'newname' }

      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => mockResponse,
      }))

      const result = await api.user.updateProfile(profileData)

      expect(result.data).toEqual(mockResponse)
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost/api/user/profile',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify(profileData),
        })
      )
    })
  })

  describe('Authentication', () => {
    it('should login with credentials', async () => {
      const mockResponse: LoginResponse = {
        success: true,
        token: 'auth_token_123',
        user: {
          id: 1,
          username: 'testuser',
          avatar: null,
          permission: false,
        },
      }
      const loginData = { username: 'test', password: 'pass' }

      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => mockResponse,
      }))

      const result = await api.auth.login(loginData)

      expect(result.data).toEqual(mockResponse)
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost/api/auth/login',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(loginData),
        })
      )
    })

    it('should check auth status', async () => {
      const mockResponse = { github: true, password: true }

      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => mockResponse,
      }))

      const result = await api.auth.status()

      expect(result.data).toEqual(mockResponse)
    })
  })

  describe('Error handling', () => {
    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      const result = await api.feed.list()

      expect(result.error).toBeDefined()
      expect(result.error?.status).toBe(0)
    })

    it('should handle JSON parsing errors', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => { throw new Error('Invalid JSON') },
        text: async () => 'Invalid JSON',
      }))

      const result = await api.feed.list()

      // When JSON parsing fails on a successful response, it's caught as a network error
      expect(result.error).toBeDefined()
      expect(result.error?.value).toContain('Invalid JSON')
    })

    it('should include credentials by default', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => ({}),
      }))

      await api.feed.list()

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          credentials: 'include',
        })
      )
    })
  })
})
