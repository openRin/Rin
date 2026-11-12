import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { BlobService, StorageService } from '../storage';
import { Hono } from "hono";
import { createMiddleware } from "hono/factory";
import type { Variables, JWTUtils, CacheImpl } from "../../core/hono-types";
import { createMockDB, createMockEnv, cleanupTestDB } from '../../../tests/fixtures';
import type { Database } from 'bun:sqlite';

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

describe('StorageService', () => {
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
        
        // Mock middleware to inject dependencies
        app.use(createMiddleware<{ Bindings: Env; Variables: Variables }>(async (c, next) => {
            c.set('db', db);
            c.set('cache', new TestCacheImpl());
            c.set('serverConfig', new TestCacheImpl());
            c.set('clientConfig', new TestCacheImpl());
            c.set('jwt', {
                sign: async (payload: any) => `mock_token_${payload.id}`,
                verify: async (token: string) => token.startsWith('mock_token_') ? { id: 1 } : null,
            } as JWTUtils);
            c.set('oauth2', undefined);
            c.set('admin', false);
            c.set('env', env);
            c.set('uid', undefined);
            
            await next();
        }));

        // Mount service
        app.route('/', StorageService());
        app.route('/blob', BlobService());

        // Create test user
        await createTestUser();
    });

    afterEach(() => {
        cleanupTestDB(sqlite);
    });

    async function createTestUser() {
        sqlite.exec(`
            INSERT INTO users (id, username, openid, avatar, permission) 
            VALUES (1, 'testuser', 'gh_test', 'avatar.png', 1)
        `);
    }

    function createAppWithEnv(appEnv: Env, uid?: number, admin = false) {
        const serviceApp = new Hono<{ Bindings: Env; Variables: Variables }>();
        serviceApp.use(createMiddleware<{ Bindings: Env; Variables: Variables }>(async (c, next) => {
            c.set('db', db);
            c.set('cache', new TestCacheImpl());
            c.set('serverConfig', new TestCacheImpl());
            c.set('clientConfig', new TestCacheImpl());
            c.set('jwt', {
                sign: async (payload: any) => `mock_token_${payload.id}`,
                verify: async (token: string) => token.startsWith('mock_token_') ? { id: 1 } : null,
            } as JWTUtils);
            c.set('env', appEnv);
            c.set('uid', uid);
            c.set('admin', admin);
            await next();
        }));
        serviceApp.route('/', StorageService());
        serviceApp.route('/blob', BlobService());
        return serviceApp;
    }

    describe('POST / - Upload file', () => {
        it('should require authentication', async () => {
            const formData = new FormData();
            formData.append('file', new File(['test content'], 'test.txt', { type: 'text/plain' }));
            
            const res = await app.request('/', {
                method: 'POST',
                body: formData,
            }, env);

            // Could be 400 (validation) or 401 (auth)
            expect(res.status).toBeGreaterThanOrEqual(400);
            expect(res.status).toBeLessThanOrEqual(401);
        });

        it('should reject anonymous upload without reading the body or writing to storage', async () => {
            const putCalls: string[] = [];
            const r2Env = createMockEnv({
                R2_BUCKET: {
                    put: async (key: string) => {
                        putCalls.push(key);
                        return {} as unknown as R2Object;
                    },
                } as unknown as R2Bucket,
            });

            const anonApp = createAppWithEnv(r2Env, undefined, false);
            const formData = new FormData();
            formData.append('key', 'test.png');
            formData.append('file', new File(['payload'], 'test.png', { type: 'image/png' }));

            const request = new Request('http://localhost/', { method: 'POST', body: formData });
            expect(request.bodyUsed).toBe(false);
            const res = await anonApp.fetch(request, r2Env);

            expect(res.status).toBe(401);
            expect(request.bodyUsed).toBe(false);
            expect(putCalls).toHaveLength(0);
        });

        it('should reject a logged-in non-admin upload without reading the body or writing to storage', async () => {
            const putCalls: string[] = [];
            const r2Env = createMockEnv({
                R2_BUCKET: {
                    put: async (key: string) => {
                        putCalls.push(key);
                        return {} as unknown as R2Object;
                    },
                } as unknown as R2Bucket,
            });

            const userApp = createAppWithEnv(r2Env, 1, false);
            const formData = new FormData();
            formData.append('key', 'test.png');
            formData.append('file', new File(['payload'], 'test.png', { type: 'image/png' }));

            const request = new Request('http://localhost/', { method: 'POST', body: formData });
            expect(request.bodyUsed).toBe(false);
            const res = await userApp.fetch(request, r2Env);

            expect(res.status).toBe(403);
            expect(request.bodyUsed).toBe(false);
            expect(putCalls).toHaveLength(0);
        });

        it('should still allow admin image uploads', async () => {
            const putCalls: Array<{ key: string; type: string | undefined }> = [];
            const r2Env = createMockEnv({
                R2_BUCKET: {
                    put: async (key: string, _value: any, options?: R2PutOptions) => {
                        putCalls.push({
                            key,
                            type: options?.httpMetadata && 'contentType' in options.httpMetadata
                                ? options.httpMetadata.contentType
                                : undefined,
                        });
                        return {} as unknown as R2Object;
                    },
                } as unknown as R2Bucket,
                S3_ACCESS_HOST: 'https://images.example.com' as any,
            });

            const adminApp = createAppWithEnv(r2Env, 1, true);
            const formData = new FormData();
            formData.append('key', 'photo.png');
            formData.append('file', new File(['png-bytes'], 'photo.png', { type: 'image/png' }));

            const res = await adminApp.request('/', { method: 'POST', body: formData }, r2Env);

            expect(res.status).toBe(200);
            expect(putCalls).toHaveLength(1);
            expect(putCalls[0]?.key).toMatch(/^images\/[a-f0-9]+\.png$/);
            expect(putCalls[0]?.type).toBe('image/png');
        });

        it('should upload through R2 binding when configured', async () => {
            const putCalls: Array<{ key: string; type: string | undefined }> = [];
            const r2Env = createMockEnv({
                R2_BUCKET: {
                    put: async (key: string, value: any, options?: R2PutOptions) => {
                        putCalls.push({
                            key,
                            type: options?.httpMetadata && 'contentType' in options.httpMetadata
                                ? options.httpMetadata.contentType
                                : undefined,
                        });
                        return {
                            key,
                            version: '1',
                            size: value.size || 0,
                            etag: 'etag',
                            httpEtag: 'etag',
                            uploaded: new Date(),
                            storageClass: 'Standard',
                            checksums: {} as R2Checksums,
                            writeHttpMetadata: () => {},
                        } as unknown as R2Object;
                    },
                } as unknown as R2Bucket,
                S3_ACCESS_HOST: 'https://images.example.com' as any,
                S3_ENDPOINT: '' as any,
                S3_BUCKET: '' as any,
                S3_ACCESS_KEY_ID: '',
                S3_SECRET_ACCESS_KEY: '',
            });

            const r2App = createAppWithEnv(r2Env, 1, true);
            const formData = new FormData();
            formData.append('key', 'test.txt');
            formData.append('file', new File(['test content'], 'test.txt', { type: 'text/plain' }));

            const res = await r2App.request('/', {
                method: 'POST',
                body: formData,
            }, r2Env);

            expect(res.status).toBe(200);
            expect(putCalls).toHaveLength(1);
            expect(putCalls[0]?.key).toMatch(/^images\/[a-f0-9]+\.txt$/);
            expect(putCalls[0]?.type).toBe('text/plain;charset=utf-8');
            const payload = await res.json() as { url: string };
            expect(payload.url).toMatch(/^https:\/\/images\.example\.com\/images\/[a-f0-9]+\.txt$/);
        });

        it('should return an /api/blob URL when R2 is configured without S3_ACCESS_HOST', async () => {
            const putCalls: string[] = [];
            const r2Env = createMockEnv({
                R2_BUCKET: {
                    put: async (key: string) => {
                        putCalls.push(key);
                        return {
                            key,
                            version: '1',
                            size: 4,
                            etag: 'etag',
                            httpEtag: 'etag',
                            uploaded: new Date(),
                            storageClass: 'Standard',
                            checksums: {} as R2Checksums,
                            writeHttpMetadata: () => {},
                        } as unknown as R2Object;
                    },
                } as unknown as R2Bucket,
                S3_ACCESS_HOST: '' as any,
                S3_ENDPOINT: '' as any,
                S3_BUCKET: '' as any,
                S3_ACCESS_KEY_ID: '',
                S3_SECRET_ACCESS_KEY: '',
            });

            const r2App = createAppWithEnv(r2Env, 1, true);
            const formData = new FormData();
            formData.append('key', 'test.txt');
            formData.append('file', new File(['test'], 'test.txt', { type: 'text/plain' }));

            const res = await r2App.request('/', {
                method: 'POST',
                body: formData,
            }, r2Env);

            expect(res.status).toBe(200);
            expect(putCalls).toHaveLength(1);

            const payload = await res.json() as { url: string };
            expect(payload.url).toMatch(/^http:\/\/localhost\/api\/blob\/images\/[a-f0-9]+\.txt$/);
        });

        it('should return 500 when S3_ENDPOINT is not defined without R2 binding', async () => {
            const envNoS3 = createMockEnv({
                S3_ENDPOINT: '' as any,
            });
            const appNoS3 = createAppWithEnv(envNoS3, 1, true);

            const formData = new FormData();
            formData.append('key', 'test.txt');
            formData.append('file', new File(['test content'], 'test.txt', { type: 'text/plain' }));
            
            const res = await appNoS3.request('/', {
                method: 'POST',
                body: formData,
            }, envNoS3);

            expect(res.status).toBe(500);
            expect(await res.text()).toBe('S3_ENDPOINT is not defined');
        });

        it('should return error when S3_ACCESS_KEY_ID is not defined without R2 binding', async () => {
            const envNoKey = createMockEnv({
                S3_ACCESS_KEY_ID: '',
            });
            const appNoKey = createAppWithEnv(envNoKey, 1, true);

            const formData = new FormData();
            formData.append('key', 'test.txt');
            formData.append('file', new File(['test content'], 'test.txt', { type: 'text/plain' }));
            
            const res = await appNoKey.request('/', {
                method: 'POST',
                body: formData,
            }, envNoKey);

            expect(res.status).toBe(500);
            expect(await res.text()).toBe('S3_ACCESS_KEY_ID is not defined');
        });
    });

    describe('GET /blob/* - active content handling', () => {
        function blobEnv(objects: Record<string, { contentType: string; body: string }>) {
            return createMockEnv({
                R2_BUCKET: {
                    get: async (key: string) => {
                        const entry = objects[key];
                        if (!entry) {
                            return null;
                        }
                        return {
                            key,
                            size: entry.body.length,
                            etag: 'etag',
                            httpEtag: 'etag',
                            uploaded: new Date('2025-01-01T00:00:00Z'),
                            storageClass: 'Standard',
                            checksums: {} as R2Checksums,
                            httpMetadata: { contentType: entry.contentType },
                            writeHttpMetadata(headers: Headers) {
                                headers.set('Content-Type', entry.contentType);
                            },
                            body: new Blob([entry.body]).stream(),
                            bodyUsed: false,
                            arrayBuffer: async () => new TextEncoder().encode(entry.body).buffer,
                            text: async () => entry.body,
                            json: async () => JSON.parse(entry.body),
                            blob: async () => new Blob([entry.body]),
                            bytes: async () => new Uint8Array(new TextEncoder().encode(entry.body)),
                        } as unknown as R2ObjectBody;
                    },
                } as unknown as R2Bucket,
                S3_ACCESS_HOST: '' as any,
            });
        }

        it('serves same-origin HTML and SVG as inert attachments', async () => {
            const r2Env = blobEnv({
                'images/page.html': { contentType: 'text/html', body: '<script>alert(1)</script>' },
                'images/logo.svg': { contentType: 'image/svg+xml', body: '<svg onload="alert(1)"/>' },
            });
            const r2App = createAppWithEnv(r2Env, undefined, false);

            for (const key of ['images/page.html', 'images/logo.svg']) {
                const res = await r2App.request(`/blob/${key}`, { method: 'GET' }, r2Env);
                expect(res.status).toBe(200);
                expect(res.headers.get('content-type')).toBe('application/octet-stream');
                expect(res.headers.get('content-disposition')).toBe('attachment');
                expect(res.headers.get('x-content-type-options')).toBe('nosniff');
                expect(res.headers.get('content-security-policy')).toContain("default-src 'none'");
                expect(res.headers.get('content-security-policy')?.split(';').map(value => value.trim())).toContain('sandbox');
            }
        });

        it('keeps images inline but still non-sniffable and public', async () => {
            const r2Env = blobEnv({
                'images/photo.png': { contentType: 'image/png', body: 'png-bytes' },
            });
            const r2App = createAppWithEnv(r2Env, undefined, false);

            const res = await r2App.request('/blob/images/photo.png', { method: 'GET' }, r2Env);

            // Public read must stay available to anonymous visitors.
            expect(res.status).toBe(200);
            expect(res.headers.get('content-type')).toBe('image/png');
            expect(res.headers.get('content-disposition')).toBe('inline');
            expect(res.headers.get('x-content-type-options')).toBe('nosniff');
            expect(res.headers.get('access-control-allow-origin')).toBe('*');
        });

        it('does not trust the key extension for content type', async () => {
            const r2Env = blobEnv({
                // A stored object named .png that actually claims HTML.
                'images/disguised.png': { contentType: 'text/html; charset=utf-8', body: '<script>alert(1)</script>' },
            });
            const r2App = createAppWithEnv(r2Env, undefined, false);

            const res = await r2App.request('/blob/images/disguised.png', { method: 'GET' }, r2Env);

            expect(res.status).toBe(200);
            expect(res.headers.get('content-type')).toBe('application/octet-stream');
            expect(res.headers.get('content-disposition')).toBe('attachment');
        });
    });

    describe('GET /blob/* - Stream file', () => {
        it.each(['text/plain', 'text/html'])('preserves gzip bytes and encoding while enforcing safe headers for %s', async (contentType) => {
            const compressed = new Uint8Array(Bun.gzipSync('<script>alert(1)</script>'));
            const r2Env = createMockEnv({
                R2_BUCKET: {
                    get: async (key: string) => ({
                        key,
                        size: compressed.byteLength,
                        httpEtag: '"gzip-etag"',
                        uploaded: new Date('2025-01-01T00:00:00Z'),
                        writeHttpMetadata(headers: Headers) {
                            headers.set('Content-Type', contentType);
                            headers.set('Content-Encoding', 'gzip');
                            headers.set('Cache-Control', 'public, max-age=60');
                            headers.set('Content-Disposition', 'inline');
                            headers.set('Content-Security-Policy', "default-src * 'unsafe-inline'");
                            headers.set('X-Content-Type-Options', 'invalid');
                            headers.set('Set-Cookie', 'untrusted=value');
                            headers.set('X-Storage-Internal', 'private');
                        },
                        body: new Blob([compressed]).stream(),
                    }) as unknown as R2ObjectBody,
                } as unknown as R2Bucket,
            });
            const r2App = createAppWithEnv(r2Env);

            const res = await r2App.request('/blob/images/compressed', { method: 'GET' }, r2Env);

            expect(res.status).toBe(200);
            expect(res.headers.get('content-encoding')).toBe('gzip');
            expect(res.headers.get('content-length')).toBe(String(compressed.byteLength));
            expect(res.headers.get('etag')).toBe('"gzip-etag"');
            expect(res.headers.get('last-modified')).toBe('Wed, 01 Jan 2025 00:00:00 GMT');
            expect(res.headers.get('cache-control')).toBe('public, max-age=60');
            expect(res.headers.get('content-type')).toBe(contentType === 'text/html' ? 'application/octet-stream' : contentType);
            expect(res.headers.get('content-disposition')).toBe(contentType === 'text/html' ? 'attachment' : 'inline');
            expect(res.headers.get('x-content-type-options')).toBe('nosniff');
            expect(res.headers.get('content-security-policy')).toBe("default-src 'none'; sandbox");
            expect(res.headers.get('set-cookie')).toBeNull();
            expect(res.headers.get('x-storage-internal')).toBeNull();
            expect(new Uint8Array(await res.arrayBuffer())).toEqual(compressed);
        });

        it('should stream an R2 object through the blob route', async () => {
            const r2Env = createMockEnv({
                R2_BUCKET: {
                    get: async (key: string) => {
                        if (key !== 'images/test.txt') {
                            return null;
                        }

                        return {
                            key,
                            size: 4,
                            etag: 'etag',
                            httpEtag: 'etag',
                            uploaded: new Date('2025-01-01T00:00:00Z'),
                            storageClass: 'Standard',
                            checksums: {} as R2Checksums,
                            httpMetadata: { contentType: 'text/plain' },
                            writeHttpMetadata(headers: Headers) {
                                headers.set('Content-Type', 'text/plain');
                            },
                            body: new Blob(['test']).stream(),
                            bodyUsed: false,
                            arrayBuffer: async () => new TextEncoder().encode('test').buffer,
                            text: async () => 'test',
                            json: async () => ({ value: 'test' }),
                            blob: async () => new Blob(['test']),
                            bytes: async () => new Uint8Array(new TextEncoder().encode('test')),
                        } as unknown as R2ObjectBody;
                    },
                } as unknown as R2Bucket,
                S3_ACCESS_HOST: '' as any,
                S3_ENDPOINT: '' as any,
                S3_BUCKET: '' as any,
                S3_ACCESS_KEY_ID: '',
                S3_SECRET_ACCESS_KEY: '',
            });

            const r2App = createAppWithEnv(r2Env, 1, true);
            const res = await r2App.request('/blob/images/test.txt', { method: 'GET' }, r2Env);

            expect(res.status).toBe(200);
            expect(res.headers.get('content-type')).toBe('text/plain');
            expect(await res.text()).toBe('test');
        });
    });
});
