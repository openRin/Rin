import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { RSSService, rssCrontab } from '../rss';
import { Hono } from "hono";
import type { Variables } from "../../core/hono-types";
import { createMockDB, createMockEnv, setupTestApp, cleanupTestDB } from '../../../tests/fixtures';
import type { Database } from 'bun:sqlite';

describe('RSSService', () => {
    let db: any;
    let sqlite: Database;
    let env: Env;
    let app: Hono<{ Bindings: Env; Variables: Variables }>;

    beforeEach(async () => {
        const ctx = await setupTestApp(RSSService);
        db = ctx.db;
        sqlite = ctx.sqlite;
        env = ctx.env;
        app = ctx.app;
        
        // Seed test data
        await seedTestData(sqlite);
    });

    afterEach(() => {
        cleanupTestDB(sqlite);
    });

    async function seedTestData(sqlite: Database) {
        sqlite.exec(`
            INSERT INTO users (id, username, avatar, openid) VALUES (1, 'testuser', 'avatar.png', 'gh_test')
        `);
        sqlite.exec(`
            INSERT INTO feeds (id, title, content, summary, uid, draft, listed, created_at, updated_at) VALUES 
                (1, 'Test Feed 1', '# Hello\n\nThis is content', 'Summary 1', 1, 0, 1, unixepoch(), unixepoch()),
                (2, 'Test Feed 2', '![image](https://example.com/img.png)', 'Summary 2', 1, 0, 1, unixepoch(), unixepoch()),
                (3, 'Draft Feed', 'Draft content', '', 1, 1, 1, unixepoch(), unixepoch())
        `);
    }

    describe('GET /:name - RSS feed endpoints', () => {
        it('should serve rss.xml', async () => {
            const res = await app.request('/rss.xml', { method: 'GET' }, env);
            
            expect(res.status).toBe(200);
            expect(res.headers.get('Content-Type')).toBe('application/rss+xml; charset=UTF-8');
            
            const text = await res.text();
            expect(text).toContain('<?xml');
            expect(text).toContain('<rss');
            expect(text).toContain('Test Feed 1');
            expect(text).toContain('Test Feed 2');
            expect(text).not.toContain('Draft Feed');
        });

        it('should serve atom.xml', async () => {
            const res = await app.request('/atom.xml', { method: 'GET' }, env);
            
            expect(res.status).toBe(200);
            expect(res.headers.get('Content-Type')).toBe('application/atom+xml; charset=UTF-8');
            
            const text = await res.text();
            expect(text).toContain('<?xml');
            expect(text).toContain('<feed');
            expect(text).toContain('Test Feed 1');
        });

        it('should serve rss.json', async () => {
            const res = await app.request('/rss.json', { method: 'GET' }, env);
            
            expect(res.status).toBe(200);
            expect(res.headers.get('Content-Type')).toBe('application/feed+json; charset=UTF-8');
            
            const data = await res.json() as any;
            expect(data).toHaveProperty('items');
            expect(data.items.length).toBe(2);
        });

        it('should serve feed.json (alias)', async () => {
            const res = await app.request('/feed.json', { method: 'GET' }, env);
            
            expect(res.status).toBe(200);
            expect(res.headers.get('Content-Type')).toBe('application/feed+json; charset=UTF-8');
        });

        it('should redirect feed.xml to rss.xml', async () => {
            const res = await app.request('/feed.xml', { method: 'GET' }, env);
            
            expect(res.status).toBe(301);
            expect(res.headers.get('Location')).toBe('/rss.xml');
        });

        it('should return 404 for unknown feed names', async () => {
            const res = await app.request('/unknown.xml', { method: 'GET' }, env);
            
            expect(res.status).toBe(404);
        });

        it('should convert markdown to HTML in content', async () => {
            const res = await app.request('/rss.xml', { method: 'GET' }, env);
            
            const text = await res.text();
            expect(text).toContain('<h1>Hello</h1>');
            expect(text).not.toContain('# Hello');
        });

        it('should include feed metadata', async () => {
            const res = await app.request('/rss.xml', { method: 'GET' }, env);
            
            const text = await res.text();
            expect(text).toContain('Test Blog');
            expect(text).toContain('Test Environment');
        });

        it('should limit to 20 items', async () => {
            for (let i = 4; i <= 25; i++) {
                sqlite.exec(`
                    INSERT INTO feeds (id, title, content, uid, draft, listed, created_at) 
                    VALUES (${i}, 'Feed ${i}', 'Content', 1, 0, 1, unixepoch())
                `);
            }
            
            const res = await app.request('/rss.xml', { method: 'GET' }, env);
            
            const text = await res.text();
            const itemCount = (text.match(/<item>/g) || []).length;
            expect(itemCount).toBeLessThanOrEqual(20);
        });

        it('should serve cached rss.xml through R2 without S3_ACCESS_HOST', async () => {
            const cachedEnv = createMockEnv({
                FRONTEND_URL: 'https://blog.example',
                S3_ACCESS_HOST: '' as any,
                S3_ENDPOINT: '' as any,
                S3_BUCKET: '' as any,
                S3_ACCESS_KEY_ID: '',
                S3_SECRET_ACCESS_KEY: '',
                R2_BUCKET: {
                    get: async (key: string) => {
                        if (key !== 'cache/rss.xml') {
                            return null;
                        }

                        return {
                            key,
                            size: 18,
                            etag: 'etag',
                            httpEtag: 'etag',
                            uploaded: new Date('2025-01-01T00:00:00Z'),
                            storageClass: 'Standard',
                            checksums: {} as R2Checksums,
                            httpMetadata: { contentType: 'application/rss+xml; charset=UTF-8' },
                            writeHttpMetadata(headers: Headers) {
                                headers.set('Content-Type', 'application/rss+xml; charset=UTF-8');
                            },
                            body: new Blob(['<rss>cached</rss>']).stream(),
                            bodyUsed: false,
                            arrayBuffer: async () => new TextEncoder().encode('<rss>cached</rss>').buffer,
                            text: async () => '<rss>cached</rss>',
                            json: async () => ({ value: 'cached' }),
                            blob: async () => new Blob(['<rss>cached</rss>']),
                            bytes: async () => new Uint8Array(new TextEncoder().encode('<rss>cached</rss>')),
                        } as unknown as R2ObjectBody;
                    },
                    head: async () => null,
                } as unknown as R2Bucket,
            });

            const ctx = await setupTestApp(RSSService, cachedEnv);
            const res = await ctx.app.request('/rss.xml', { method: 'GET' }, cachedEnv);

            expect(res.status).toBe(200);
            expect(await res.text()).toBe('<rss>cached</rss>');

            cleanupTestDB(ctx.sqlite);
        });

        it('uses the request origin and bypasses shared storage without FRONTEND_URL', async () => {
            let getCalls = 0;
            const originEnv = createMockEnv({
                R2_BUCKET: {
                    get: async () => {
                        getCalls += 1;
                        return null;
                    },
                    head: async () => null,
                } as unknown as R2Bucket,
            });
            const ctx = await setupTestApp(RSSService, originEnv);
            ctx.sqlite.exec(`INSERT INTO users (id, username, openid) VALUES (1, 'testuser', 'gh_test')`);
            ctx.sqlite.exec(`INSERT INTO feeds (id, title, content, uid, draft, listed) VALUES (1, 'Feed', 'Content', 1, 0, 1)`);

            const res = await ctx.app.request('https://origin.example/rss.xml', { method: 'GET' }, originEnv);

            expect(res.status).toBe(200);
            expect(await res.text()).toContain('https://origin.example/feed/1');
            expect(getCalls).toBe(0);

            cleanupTestDB(ctx.sqlite);
        });

        it('normalizes a configured FRONTEND_URL before generating feed links', async () => {
            const canonicalEnv = createMockEnv({
                FRONTEND_URL: '  https://canonical.example/  ',
                R2_BUCKET: {
                    get: async () => null,
                    head: async () => null,
                } as unknown as R2Bucket,
            });
            const ctx = await setupTestApp(RSSService, canonicalEnv);
            ctx.sqlite.exec(`INSERT INTO users (id, username, openid) VALUES (1, 'testuser', 'gh_test')`);
            ctx.sqlite.exec(`INSERT INTO feeds (id, title, content, uid, draft, listed) VALUES (1, 'Feed', 'Content', 1, 0, 1)`);

            const res = await ctx.app.request('https://origin.example/rss.xml', { method: 'GET' }, canonicalEnv);
            const text = await res.text();

            expect(res.status).toBe(200);
            expect(text).toContain('https://canonical.example/feed/1');
            expect(text).not.toContain('https://canonical.example//feed/1');

            cleanupTestDB(ctx.sqlite);
        });

        it('uses the request origin when FRONTEND_URL contains only whitespace', async () => {
            let getCalls = 0;
            const originEnv = createMockEnv({
                FRONTEND_URL: '   ',
                R2_BUCKET: {
                    get: async () => {
                        getCalls += 1;
                        return null;
                    },
                    head: async () => null,
                } as unknown as R2Bucket,
            });
            const ctx = await setupTestApp(RSSService, originEnv);
            ctx.sqlite.exec(`INSERT INTO users (id, username, openid) VALUES (1, 'testuser', 'gh_test')`);
            ctx.sqlite.exec(`INSERT INTO feeds (id, title, content, uid, draft, listed) VALUES (1, 'Feed', 'Content', 1, 0, 1)`);

            const res = await ctx.app.request('https://origin.example/rss.xml', { method: 'GET' }, originEnv);

            expect(res.status).toBe(200);
            expect(await res.text()).toContain('https://origin.example/feed/1');
            expect(getCalls).toBe(0);

            cleanupTestDB(ctx.sqlite);
        });
    });
});

describe('rssCrontab', () => {
    let db: any;
    let sqlite: Database;
    let env: Env;

    beforeEach(async () => {
        const mockDB = createMockDB();
        db = mockDB.db;
        sqlite = mockDB.sqlite;
        env = createMockEnv();
        
        sqlite.exec(`INSERT INTO users (id, username, openid) VALUES (1, 'testuser', 'gh_test')`);
        sqlite.exec(`
            INSERT INTO feeds (id, title, content, uid, draft, listed) VALUES 
                (1, 'Feed 1', 'Content 1', 1, 0, 1),
                (2, 'Feed 2', 'Content 2', 1, 0, 1)
        `);
    });

    afterEach(() => {
        cleanupTestDB(sqlite);
    });

    it('generates and saves RSS feeds when FRONTEND_URL is configured', async () => {
        const keys: string[] = [];
        env = createMockEnv({
            FRONTEND_URL: 'https://blog.example',
            R2_BUCKET: {
                head: async () => null,
                put: async (key: string) => {
                    keys.push(key);
                    return null;
                },
            } as unknown as R2Bucket,
        });

        await rssCrontab(env, db);

        expect(keys).toEqual(['cache/rss.xml', 'cache/atom.xml', 'cache/rss.json']);
    });

    it('should handle missing feeds gracefully', async () => {
        sqlite.exec('DELETE FROM feeds');
        
        try {
            await rssCrontab(env, db);
        } catch (e) {
            // Should not throw
        }
    });

    it('does not write RSS storage cache without FRONTEND_URL', async () => {
        let putCalls = 0;
        env = createMockEnv({
            R2_BUCKET: {
                put: async () => {
                    putCalls += 1;
                    return null;
                },
            } as unknown as R2Bucket,
        });

        await rssCrontab(env, db);

        expect(putCalls).toBe(0);
    });
});
