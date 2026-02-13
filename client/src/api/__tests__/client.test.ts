import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createClient } from '../client'

const api = createClient('http://localhost')

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('API Client', () => {
  beforeEach(() => {
    mockFetch.mockClear()
  })

  describe('Feed API', () => {
    it('should fetch feed list', async () => {
      const mockResponse = {
        size: 2,
        data: [
          { id: 1, title: 'Feed 1', content: 'Content 1' },
          { id: 2, title: 'Feed 2', content: 'Content 2' },
        ],
        hasNext: false,
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => mockResponse,
      })

      const result = await api.feed.list({ page: 1, limit: 10 })

      expect(result.data).toEqual(mockResponse)
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/feed?page=1&limit=10'),
        expect.any(Object)
      )
    })

    it('should handle feed list error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        headers: new Map(),
        json: async () => ({ error: 'Server error' }),
      })

      const result = await api.feed.list({ page: 1 })

      expect(result.error).toBeDefined()
      expect(result.error?.status).toBe(500)
    })

    it('should fetch single feed', async () => {
      const mockResponse = { id: 1, title: 'Feed 1', content: 'Content 1' }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => mockResponse,
      })

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

      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => mockResponse,
      })

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
      const mockResponse = [
        { id: 1, name: 'tag1', feeds: 5 },
        { id: 2, name: 'tag2', feeds: 3 },
      ]

      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => mockResponse,
      })

      const result = await api.tag.list()

      expect(result.data).toEqual(mockResponse)
    })

    it('should fetch tag by name', async () => {
      const mockResponse = { id: 1, name: 'tag1', feeds: [{ id: 1, title: 'Feed 1' }] }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => mockResponse,
      })

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
      const mockResponse = [
        { id: 1, content: 'Comment 1', user: { id: 1, username: 'user1' } },
        { id: 2, content: 'Comment 2', user: { id: 2, username: 'user2' } },
      ]

      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => mockResponse,
      })

      const result = await api.comment.list(1)

      expect(result.data).toEqual(mockResponse)
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost/api/comment/1',
        expect.any(Object)
      )
    })

    it('should create comment', async () => {
      const mockResponse = { id: 1, content: 'New comment', user: { id: 1, username: 'user1' } }
      const commentData = { content: 'New comment' }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => mockResponse,
      })

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

      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => mockResponse,
      })

      const result = await api.user.profile()

      expect(result.data).toEqual(mockResponse)
    })

    it('should update profile', async () => {
      const mockResponse = { success: true }
      const profileData = { username: 'newname' }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => mockResponse,
      })

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
      const mockResponse = {
        success: true,
        token: 'auth_token_123',
        user: { id: 1, username: 'testuser' },
      }
      const loginData = { username: 'test', password: 'pass' }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => mockResponse,
      })

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

      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => mockResponse,
      })

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
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => { throw new Error('Invalid JSON') },
        text: async () => 'Invalid JSON',
      })

      const result = await api.feed.list()

      // When JSON parsing fails on a successful response, it's caught as a network error
      expect(result.error).toBeDefined()
      expect(result.error?.value).toContain('Invalid JSON')
    })

    it('should include credentials by default', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => ({}),
      })

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
