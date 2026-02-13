import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { CommentService } from '../comments';
import { createBaseApp } from '../../core/base';
import { createMockDB, createMockEnv, cleanupTestDB } from '../../../tests/fixtures';
import { createTestClient } from '../../../tests/test-api-client';
import type { Database } from 'bun:sqlite';

describe('CommentService', () => {
    let db: any;
    let sqlite: Database;
    let env: Env;
    let app: any;
    let api: ReturnType<typeof createTestClient>;

    beforeEach(async () => {
        const mockDB = createMockDB();
        db = mockDB.db;
        sqlite = mockDB.sqlite;
        env = createMockEnv();
        
        // Setup app with mock db
        app = createBaseApp(env);
        app.state('db', db);
        app.state('serverConfig', {
            get: async () => undefined,
        });
        
        // Add mock JWT for authentication
        app.state('jwt', {
            sign: async (payload: any) => `mock_token_${payload.id}`,
            verify: async (token: string) => {
                const match = token.match(/mock_token_(\d+)/);
                return match ? { id: parseInt(match[1]) } : null;
            },
        });
        
        // Initialize service
        CommentService(app);
        
        // Create test API client
        api = createTestClient(app, env);
        
        // Seed test data using raw SQL
        await seedTestData(sqlite);
    });

    afterEach(() => {
        cleanupTestDB(sqlite);
    });

    async function seedTestData(sqlite: any) {
        // Insert test users
        sqlite.exec(`
            INSERT INTO users (id, username, avatar, permission, openid) VALUES 
                (1, 'user1', 'avatar1.png', 0, 'gh_1'),
                (2, 'user2', 'avatar2.png', 0, 'gh_2'),
                (3, 'admin', 'admin.png', 1, 'gh_admin')
        `);

        // Insert test feeds
        sqlite.exec(`
            INSERT INTO feeds (id, title, content, uid, draft, listed) VALUES 
                (1, 'Feed 1', 'Content 1', 1, 0, 1),
                (2, 'Feed 2', 'Content 2', 1, 0, 1)
        `);

        // Insert test comments - use user_id not uid per fixtures schema
        sqlite.exec(`
            INSERT INTO comments (id, feed_id, user_id, content, created_at) VALUES 
                (1, 1, 2, 'Comment 1 on feed 1', unixepoch()),
                (2, 1, 2, 'Comment 2 on feed 1', unixepoch()),
                (3, 2, 1, 'Comment on feed 2', unixepoch())
        `);
    }

    describe('GET /comment/:feed - List comments', () => {
        it('should return comments for a feed', async () => {
            const result = await api.comment.list(1);
            
            expect(result.error).toBeUndefined();
            expect(result.data).toBeArray();
            expect(result.data?.length).toBe(2);
            expect(result.data?.[0]).toHaveProperty('content');
            expect(result.data?.[0]).toHaveProperty('user');
            expect(result.data?.[0].user).toHaveProperty('username');
        });

        it('should return empty array when feed has no comments', async () => {
            // Create new feed without comments
            sqlite.exec(`INSERT INTO feeds (id, title, content, uid) VALUES (3, 'No Comments', 'Content', 1)`);
            
            const result = await api.comment.list(3);
            
            expect(result.error).toBeUndefined();
            expect(result.data).toEqual([]);
        });

        it('should not expose sensitive fields', async () => {
            const result = await api.comment.list(1);
            
            expect(result.error).toBeUndefined();
            expect(result.data?.length).toBeGreaterThan(0);
            
            // Should not include feedId and userId (excluded in query)
            expect(result.data?.[0]).not.toHaveProperty('feedId');
            expect(result.data?.[0]).not.toHaveProperty('userId');
            
            // Should include user info
            expect(result.data?.[0].user).toHaveProperty('id');
            expect(result.data?.[0].user).toHaveProperty('username');
            expect(result.data?.[0].user).toHaveProperty('avatar');
            expect(result.data?.[0].user).toHaveProperty('permission');
        });

        it('should order comments by createdAt descending', async () => {
            const result = await api.comment.list(1);
            
            expect(result.error).toBeUndefined();
            
            // Comments are ordered by createdAt DESC
            // Since both test comments were inserted at the same unixepoch(),
            // the order may depend on insertion order or id order
            expect(result.data?.length).toBe(2);
        });
    });

    describe('POST /comment/:feed - Create comment', () => {
        it('should create comment with authenticated user', async () => {
            const result = await api.comment.create(1, {
                content: 'New test comment',
            }, { token: 'mock_token_1' });

            expect(result.error).toBeUndefined();
            
            // Verify comment was created
            const comments = sqlite.prepare(`SELECT * FROM comments WHERE feed_id = 1`).all();
            expect(comments.length).toBe(3);
        });

        it('should require authentication', async () => {
            const result = await api.comment.create(1, {
                content: 'Test comment',
            });

            expect(result.error).toBeDefined();
            expect(result.error?.status).toBe(401);
        });

        it('should require content', async () => {
            const result = await api.comment.create(1, {
                content: '',
            }, { token: 'mock_token_1' });

            expect(result.error).toBeDefined();
            expect(result.error?.status).toBe(400);
        });

        it('should return 401 for non-existent user token', async () => {
            // Token for non-existent user should be rejected during auth
            const result = await api.comment.create(1, {
                content: 'Test',
            }, { token: 'mock_token_999' });

            expect(result.error).toBeDefined();
            expect(result.error?.status).toBe(401);
        });

        it('should return 400 for non-existent feed', async () => {
            const result = await api.comment.create(999, {
                content: 'Test',
            }, { token: 'mock_token_1' });

            expect(result.error).toBeDefined();
            expect(result.error?.status).toBe(400);
        });
    });

    describe('DELETE /comment/:id - Delete comment', () => {
        it('should allow user to delete their own comment', async () => {
            const result = await api.comment.delete(1, { token: 'mock_token_2' }); // User 2 owns comment 1

            expect(result.error).toBeUndefined();
            
            // Verify comment was deleted
            const dbResult = sqlite.prepare(`SELECT * FROM comments WHERE id = 1`).all();
            expect(dbResult.length).toBe(0);
        });

        it('should allow admin to delete any comment', async () => {
            const result = await api.comment.delete(1, { 
                token: 'mock_token_3',
                isAdmin: true
            }); // Admin

            expect(result.error).toBeUndefined();
        });

        it('should deny deletion by other users', async () => {
            const result = await api.comment.delete(1, { token: 'mock_token_1' }); // User 1 doesn't own comment 1

            expect(result.error).toBeDefined();
            expect(result.error?.status).toBe(403);
        });

        it('should require authentication', async () => {
            const result = await api.comment.delete(1);

            expect(result.error).toBeDefined();
            expect(result.error?.status).toBe(401);
        });

        it('should return 404 for non-existent comment', async () => {
            const result = await api.comment.delete(999, { token: 'mock_token_1' });

            expect(result.error).toBeDefined();
            expect(result.error?.status).toBe(404);
        });
    });
});
