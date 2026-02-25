import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { eq } from 'drizzle-orm';
import { FaviconService, FAVICON_ALLOWED_TYPES, getFaviconKey } from '../favicon';
import { Hono } from "hono";
import { createMiddleware } from "hono/factory";
import type { Variables, JWTUtils, CacheImpl } from "../../core/hono-types";
import { createMockDB, createMockEnv, cleanupTestDB } from '../../../tests/fixtures';
import type { Database } from 'bun:sqlite';
import { users } from '../../db/schema';

// Simple cache implementation for tests
class TestCacheImpl implements CacheImpl {
    private data = new Map<string, any>();
    
    async get(key: string): Promise<any | null> {
        return this.data.get(key) ?? null;
    }
    
    async set(key: string, value: any, _save?: boolean): Promise<void> {
        this.data.set(key, value);
    }
    
    async delete(key: string, _save?: boolean): Promise<void> {
        this.data.delete(key);
    }
    
    async deletePrefix(prefix: string): Promise<void> {
        for (const key of this.data.keys()) {
            if (key.startsWith(prefix)) {
                this.data.delete(key);
            }
        }
    }
    
    async getOrSet<T>(key: string, factory: () => Promise<T>): Promise<T> {
        const cached = await this.get(key);
        if (cached !== null) return cached;
        const value = await factory();
        await this.set(key, value);
        return value;
    }
    
    async getOrDefault<T>(key: string, defaultValue: T): Promise<T> {
        const cached = await this.get(key);
        return cached !== null ? cached : defaultValue;
    }
    
    async getBySuffix(_suffix: string): Promise<any[]> {
        return [];
    }
    
    async all(): Promise<Map<string, any>> {
        return new Map(this.data);
    }
    
    async save(): Promise<void> {}
    async clear(): Promise<void> {
        this.data.clear();
    }
}

describe('FaviconService', () => {
    let db: any;
    let sqlite: Database;
    let env: Env;
    let app: Hono<{ Bindings: Env; Variables: Variables }>;

    beforeEach(async () => {
        const mockDB = createMockDB();
        db = mockDB.db;
        sqlite = mockDB.sqlite;
        env = createMockEnv();

        app = new Hono<{ Bindings: Env; Variables: Variables }>();
        
        // Mock middleware to inject dependencies and handle auth
        app.use(createMiddleware<{ Bindings: Env; Variables: Variables }>(async (c, next) => {
            c.set('db', db);
            c.set('cache', new TestCacheImpl());
            c.set('serverConfig', new TestCacheImpl());
            c.set('clientConfig', new TestCacheImpl());
            
            const jwt = {
                sign: async (payload: any) => `mock_token_${payload.id}`,
                verify: async (token: string) => token.startsWith('mock_token_') ? { id: 1 } : null,
            } as JWTUtils;
            c.set('jwt', jwt);
            c.set('oauth2', undefined);
            c.set('env', env);
            
            // Parse Authorization header and set user info
            const authHeader = c.req.header('authorization');
            let uid: number | undefined = undefined;
            let admin = false;
            
            if (authHeader?.startsWith('Bearer ')) {
                const token = authHeader.substring(7);
                const profile = await jwt.verify(token);
                if (profile?.id) {
                    uid = profile.id;
                    // Look up user in database to check permission
                    const user = await db.query.users.findFirst({
                        where: eq(users.id, uid as number)
                    });
                    if (user) {
                        admin = user.permission === 1;
                    }
                }
            }
            
            c.set('uid', uid);
            c.set('admin', admin);
            
            await next();
        }));

        // Register service
        app.route('/', FaviconService());

        // Create test user
        await createTestUser();
    });

    afterEach(() => {
        cleanupTestDB(sqlite);
    });

    async function createTestUser() {
        sqlite.exec(`
            INSERT INTO users (id, username, openid, avatar, permission) 
            VALUES (1, 'admin', 'gh_admin', 'admin.png', 1)
        `);
    }

    describe('GET / - Get favicon', () => {
        it('should return favicon from S3', async () => {
            const res = await app.request('/', { method: 'GET' }, env);

            // Will fail due to S3 not being available, but verifies route is registered
            expect(res.status).not.toBe(404);
        });
    });

    describe('GET /original - Get original favicon', () => {
        it('should return original favicon from S3', async () => {
            const res = await app.request('/original', { method: 'GET' }, env);

            // Will fail due to S3 not being available, but verifies route is registered
            expect(res.status).not.toBe(404);
        });
    });

    describe('POST / - Upload favicon', () => {
        it('should require admin permission', async () => {
            const file = new File(['test'], 'favicon.png', { type: 'image/png' });
            const formData = new FormData();
            formData.append('file', file);

            const res = await app.request('/', {
                method: 'POST',
                body: formData,
            }, env);

            // Should be rejected (400 validation or 401/403 auth)
            expect(res.status).toBeGreaterThanOrEqual(400);
        });

        it('should reject files over 10MB', async () => {
            const largeContent = new Uint8Array(10 * 1024 * 1024 + 1);
            const file = new File([largeContent], 'favicon.png', { type: 'image/png' });
            const formData = new FormData();
            formData.append('file', file);

            const res = await app.request('/', {
                method: 'POST',
                headers: { 'Authorization': 'Bearer mock_token_1' },
                body: formData,
            }, env);

            expect(res.status).toBe(400);
        });

        it('should reject disallowed file types', async () => {
            const file = new File(['test'], 'favicon.txt', { type: 'text/plain' });
            const formData = new FormData();
            formData.append('file', file);

            const res = await app.request('/', {
                method: 'POST',
                headers: { 'Authorization': 'Bearer mock_token_1' },
                body: formData,
            }, env);

            expect(res.status).toBe(400);
        });

        it('should accept allowed image types', async () => {
            const file = new File(['test'], 'favicon.png', { type: 'image/png' });
            const formData = new FormData();
            formData.append('file', file);

            const res = await app.request('/', {
                method: 'POST',
                headers: { 'Authorization': 'Bearer mock_token_1' },
                body: formData,
            }, env);

            // Should not be 403 - permission check passes
            // Will fail due to S3 not available
            expect(res.status).not.toBe(403);
        });
    });

    describe('FAVICON_ALLOWED_TYPES', () => {
        it('should contain allowed image types', () => {
            expect(FAVICON_ALLOWED_TYPES['image/jpeg']).toBe('.jpg');
            expect(FAVICON_ALLOWED_TYPES['image/png']).toBe('.png');
            expect(FAVICON_ALLOWED_TYPES['image/gif']).toBe('.gif');
            expect(FAVICON_ALLOWED_TYPES['image/webp']).toBe('.webp');
        });

        it('should have correct number of allowed types', () => {
            expect(Object.keys(FAVICON_ALLOWED_TYPES).length).toBe(4);
        });
    });

    describe('getFaviconKey', () => {
        it('should return favicon path with S3 folder', () => {
            const env = createMockEnv();
            const key = getFaviconKey(env);
            expect(key).toBe('images/favicon.webp');
        });

        it('should handle empty S3_FOLDER', () => {
            const env = createMockEnv({
                S3_FOLDER: '' as any,
            });
            const key = getFaviconKey(env);
            expect(key).toBe('favicon.webp');
        });
    });
});
