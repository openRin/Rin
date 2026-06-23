import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { FeedService, SearchService } from '../feed';
import { Hono } from "hono";
import type { Variables } from "../../core/hono-types";
import { setupTestApp, createTestUser, cleanupTestDB } from '../../../tests/fixtures';
import type { Database } from 'bun:sqlite';
import type { TestCacheImpl } from '../../../tests/fixtures';

describe('FeedService', () => {
    let db: any;
    let sqlite: Database;
    let env: Env;
    let app: Hono<{ Bindings: Env; Variables: Variables }>;
    let cache: TestCacheImpl;
    let serverConfig: TestCacheImpl;
    let clientConfig: TestCacheImpl;

    beforeEach(async () => {
        const ctx = await setupTestApp(FeedService);
        db = ctx.db;
        sqlite = ctx.sqlite;
        env = ctx.env;
        app = ctx.app;
        cache = ctx.cache;
        serverConfig = ctx.serverConfig;
        clientConfig = ctx.clientConfig;
        
        // Create test user
        await createTestUser(sqlite);
    });

    afterEach(() => {
        cleanupTestDB(sqlite);
    });



    describe('GET / - List feeds', () => {
        it('should list published feeds', async () => {
            // Create feeds via API
            const res1 = await app.request('/', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer mock_token_1',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    title: 'Test Feed 1',
                    content: 'Content 1',
                    listed: true,
                    draft: false,
                    tags: [],
                }),
            }, env);
            expect(res1.status).toBe(200);
            
            const res2 = await app.request('/', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer mock_token_1',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    title: 'Test Feed 2',
                    content: 'Content 2',
                    listed: true,
                    draft: false,
                    tags: [],
                }),
            }, env);
            expect(res2.status).toBe(200);
            
            const listRes = await app.request('/?page=1&limit=10', { method: 'GET' }, env);
            
            expect(listRes.status).toBe(200);
            const data = await listRes.json() as any;
            expect(data.size).toBe(2);
            expect(data.data).toBeArray();
        });

        it('should return empty list when no feeds exist', async () => {
            const res = await app.request('/', { method: 'GET' }, env);
            
            expect(res.status).toBe(200);
            const data = await res.json() as any;
            expect(data.size).toBe(0);
            expect(data.data).toEqual([]);
        });

        it('should filter drafts for non-admin users', async () => {
            // Create a draft feed
            await app.request('/', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer mock_token_1',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    title: 'Draft Feed',
                    content: 'Draft Content',
                    listed: true,
                    draft: true,
                    tags: [],
                }),
            }, env);
            
            const res = await app.request('/?type=draft', { method: 'GET' }, env);
            
            expect(res.status).toBe(403);
        });

        it('should allow admin to view drafts', async () => {
            // Create a draft feed
            await app.request('/', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer mock_token_1',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    title: 'Draft Feed',
                    content: 'Draft Content',
                    listed: true,
                    draft: true,
                    tags: [],
                }),
            }, env);
            
            const res = await app.request('/?type=draft', {
                method: 'GET',
                headers: { 'Authorization': 'Bearer mock_token_1' },
            }, env);
            
            expect(res.status).toBe(200);
            const data = await res.json() as any;
            expect(data.size).toBe(1);
        });
    });

    describe('GET /:id - Get single feed', () => {
        it('should return feed by id', async () => {
            // Create a feed first
            const createRes = await app.request('/', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer mock_token_1',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    title: 'Test Feed',
                    content: 'Test Content',
                    listed: true,
                    draft: false,
                    tags: [],
                }),
            }, env);
            
            expect(createRes.status).toBe(200);
            const createData = await createRes.json() as any;
            const feedId = createData.insertedId;
            
            const getRes = await app.request(`/${feedId}`, { method: 'GET' }, env);
            
            expect(getRes.status).toBe(200);
            const data = await getRes.json() as any;
            expect(data.title).toBe('Test Feed');
        });

        it('should prefer a numeric feed id over another feed numeric alias', async () => {
            const firstRes = await app.request('/', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer mock_token_1',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    title: 'Previous Feed',
                    alias: '2',
                    content: 'Previous Content',
                    listed: true,
                    draft: false,
                    tags: [],
                }),
            }, env);
            expect(firstRes.status).toBe(200);

            const secondRes = await app.request('/', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer mock_token_1',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    title: 'Target Feed',
                    content: 'Target Content',
                    listed: true,
                    draft: false,
                    tags: [],
                }),
            }, env);
            expect(secondRes.status).toBe(200);
            const secondData = await secondRes.json() as any;

            const getRes = await app.request(`/${secondData.insertedId}`, { method: 'GET' }, env);

            expect(getRes.status).toBe(200);
            const data = await getRes.json() as any;
            expect(data.id).toBe(secondData.insertedId);
            expect(data.title).toBe('Target Feed');
            expect(data.content).toBe('Target Content');
        });

        it('should return feed by non-numeric alias', async () => {
            const createRes = await app.request('/', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer mock_token_1',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    title: 'Alias Feed',
                    alias: 'custom-slug',
                    content: 'Alias Content',
                    listed: true,
                    draft: false,
                    tags: [],
                }),
            }, env);

            expect(createRes.status).toBe(200);

            const getRes = await app.request('/custom-slug', { method: 'GET' }, env);

            expect(getRes.status).toBe(200);
            const data = await getRes.json() as any;
            expect(data.title).toBe('Alias Feed');
        });

        it('should return AI summary generation status for a queued feed', async () => {
            await serverConfig.set('ai_summary.enabled', 'true', false);
            await serverConfig.set('ai_summary.provider', 'worker-ai', false);
            await serverConfig.set('ai_summary.model', 'llama-3-8b', false);

            const createRes = await app.request('/', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer mock_token_1',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    title: 'Queued AI Feed',
                    content: 'Queued AI content',
                    listed: true,
                    draft: false,
                    tags: [],
                }),
            }, env);

            const createData = await createRes.json() as any;
            const getRes = await app.request(`/${createData.insertedId}`, { method: 'GET' }, env);

            expect(getRes.status).toBe(200);
            const data = await getRes.json() as any;
            expect(data.ai_summary_status).toBe('pending');
            expect(data.ai_summary_error).toBe('');
        });

        it('should return 404 for non-existent feed', async () => {
            const res = await app.request('/9999', { method: 'GET' }, env);
            
            expect(res.status).toBe(404);
        });

        it('should bypass stale public cache when cache is disabled', async () => {
            await clientConfig.set('cache.enabled', false);
            await clientConfig.set('counter.enabled', false);

            const createRes = await app.request('/', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer mock_token_1',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    title: 'Fresh Feed',
                    content: 'Fresh Content',
                    listed: true,
                    draft: false,
                    tags: [],
                }),
            }, env);

            const createData = await createRes.json() as any;
            await cache.set(`feed_${createData.insertedId}`, {
                id: createData.insertedId,
                title: 'Stale Feed',
                content: 'stale',
                summary: '',
                ai_summary: '',
                ai_summary_status: 'idle',
                ai_summary_error: '',
                draft: 0,
                listed: 1,
                uid: 1,
                alias: null,
                hashtags: [],
                user: { id: 1, username: 'testuser', avatar: 'avatar.png' },
            });

            const getRes = await app.request(`/${createData.insertedId}`, { method: 'GET' }, env);
            const data = await getRes.json() as any;

            expect(data.title).toBe('Fresh Feed');
        });

        it('should only write published listed feed details to public cache', async () => {
            await clientConfig.set('cache.enabled', true);
            await clientConfig.set('counter.enabled', false);

            async function createFeed(title: string, content: string, listed: boolean, draft: boolean) {
                const res = await app.request('/', {
                    method: 'POST',
                    headers: {
                        'Authorization': 'Bearer mock_token_1',
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        title,
                        content,
                        listed,
                        draft,
                        tags: [],
                    }),
                }, env);
                expect(res.status).toBe(200);
                return ((await res.json()) as any).insertedId as number;
            }

            const publicId = await createFeed('Public Cache Feed', 'Public cache content', true, false);
            const draftId = await createFeed('Draft Cache Feed', 'Draft private content', true, true);
            const unlistedId = await createFeed('Unlisted Cache Feed', 'Unlisted private content', false, false);

            const publicRes = await app.request(`/${publicId}`, { method: 'GET' }, env);
            expect(publicRes.status).toBe(200);

            const draftRes = await app.request(`/${draftId}`, {
                method: 'GET',
                headers: { 'Authorization': 'Bearer mock_token_1' },
            }, env);
            expect(draftRes.status).toBe(200);

            const unlistedRes = await app.request(`/${unlistedId}`, { method: 'GET' }, env);
            expect(unlistedRes.status).toBe(200);

            const entries = await cache.all();
            expect(entries.has(`public_feed_id_${publicId}`)).toBe(true);
            expect(entries.has(`public_feed_id_${draftId}`)).toBe(false);
            expect(entries.has(`public_feed_id_${unlistedId}`)).toBe(false);

            const serializedCache = JSON.stringify(Object.fromEntries(entries));
            expect(serializedCache).not.toContain('Draft private content');
            expect(serializedCache).not.toContain('Unlisted private content');
        });
    });

    describe('POST / - Create feed', () => {
        it('should create feed with admin permission', async () => {
            const res = await app.request('/', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer mock_token_1',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    title: 'New Test Feed',
                    content: 'This is a new test feed content',
                    listed: true,
                    draft: false,
                    tags: [],
                }),
            }, env);

            expect(res.status).toBe(200);
            const data = await res.json() as any;
            expect(data.insertedId).toBeDefined();
        });

        it('should require admin permission', async () => {
            // Create app without admin permission
            const res = await app.request('/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: 'Test',
                    content: 'Test',
                    tags: [],
                    draft: false,
                    listed: true,
                }),
            }, env);

            expect(res.status).toBe(403);
        });

        it('should require title', async () => {
            const res = await app.request('/', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer mock_token_1',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    content: 'Content without title',
                    tags: [],
                    draft: false,
                    listed: true,
                }),
            }, env);

            expect(res.status).toBe(400);
        });

        it('should require content', async () => {
            const res = await app.request('/', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer mock_token_1',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    title: 'Test',
                    content: '',
                    tags: [],
                }),
            }, env);

            expect(res.status).toBe(400);
        });
    });

    describe('POST /:id - Update feed', () => {
        it('should update feed with admin permission', async () => {
            // Create feed first
            const createRes = await app.request('/', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer mock_token_1',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    title: 'Original Title',
                    content: 'Original Content',
                    listed: true,
                    draft: false,
                    tags: [],
                }),
            }, env);
            
            expect(createRes.status).toBe(200);
            const createData = await createRes.json() as any;
            const feedId = createData.insertedId;
            
            const updateRes = await app.request(`/${feedId}`, {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer mock_token_1',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    title: 'Updated Title',
                    content: 'Updated content',
                    listed: true,
                }),
            }, env);

            expect(updateRes.status).toBe(200);
            
            // Verify update
            const getRes = await app.request(`/${feedId}`, { method: 'GET' }, env);
            const data = await getRes.json() as any;
            expect(data.title).toBe('Updated Title');
        });

        it('should return updated content through unchanged alias after edit', async () => {
            await clientConfig.set('counter.enabled', false);

            const createRes = await app.request('/', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer mock_token_1',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    title: 'Alias Title',
                    alias: 'alias-post',
                    content: 'Original alias content',
                    listed: true,
                    draft: false,
                    tags: [],
                }),
            }, env);

            expect(createRes.status).toBe(200);
            const createData = await createRes.json() as any;
            const feedId = createData.insertedId;

            const cachedAliasRes = await app.request('/alias-post', { method: 'GET' }, env);
            expect(cachedAliasRes.status).toBe(200);
            expect(((await cachedAliasRes.json()) as any).content).toBe('Original alias content');

            const updateRes = await app.request(`/${feedId}`, {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer mock_token_1',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    title: 'Alias Title Updated',
                    alias: 'alias-post',
                    content: 'Updated alias content',
                    listed: true,
                }),
            }, env);

            expect(updateRes.status).toBe(200);

            const aliasRes = await app.request('/alias-post', { method: 'GET' }, env);
            expect(aliasRes.status).toBe(200);
            const aliasData = await aliasRes.json() as any;
            expect(aliasData.title).toBe('Alias Title Updated');
            expect(aliasData.content).toBe('Updated alias content');

            const idRes = await app.request(`/${feedId}`, { method: 'GET' }, env);
            expect(idRes.status).toBe(200);
            expect(((await idRes.json()) as any).content).toBe('Updated alias content');
        });

        it('should require admin permission to update', async () => {
            // Create feed first
            const createRes = await app.request('/', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer mock_token_1',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    title: 'Original',
                    content: 'Content',
                    listed: true,
                    draft: false,
                    tags: [],
                }),
            }, env);
            
            expect(createRes.status).toBe(200);
            const createData = await createRes.json() as any;
            const feedId = createData.insertedId;
            
            const updateRes = await app.request(`/${feedId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: 'New Title',
                    listed: true,
                }),
            }, env);

            expect(updateRes.status).toBe(403);
        });
    });

    describe('DELETE /:id - Delete feed', () => {
        it('should delete feed with admin permission', async () => {
            // Create feed first
            const createRes = await app.request('/', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer mock_token_1',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    title: 'To Delete',
                    content: 'Content',
                    listed: true,
                    draft: false,
                    tags: [],
                }),
            }, env);
            
            expect(createRes.status).toBe(200);
            const createData = await createRes.json() as any;
            const feedId = createData.insertedId;
            
            const deleteRes = await app.request(`/${feedId}`, {
                method: 'DELETE',
                headers: { 'Authorization': 'Bearer mock_token_1' },
            }, env);

            expect(deleteRes.status).toBe(200);
            
            // Verify deletion
            const getRes = await app.request(`/${feedId}`, { method: 'GET' }, env);
            expect(getRes.status).toBe(404);
        });

        it('should require admin permission to delete', async () => {
            // Create feed first
            const createRes = await app.request('/', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer mock_token_1',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    title: 'Test',
                    content: 'Content',
                    listed: true,
                    draft: false,
                    tags: [],
                }),
            }, env);
            
            expect(createRes.status).toBe(200);
            const createData = await createRes.json() as any;
            const feedId = createData.insertedId;
            
            const deleteRes = await app.request(`/${feedId}`, { method: 'DELETE' }, env);

            expect(deleteRes.status).toBe(403);
        });

        it('should return 404 for non-existent feed', async () => {
            const res = await app.request('/9999', {
                method: 'DELETE',
                headers: { 'Authorization': 'Bearer mock_token_1' },
            }, env);

            expect(res.status).toBe(404);
        });
    });
});

describe('SearchService', () => {
    let sqlite: Database;
    let env: Env;
    let app: Hono<{ Bindings: Env; Variables: Variables }>;
    let cache: TestCacheImpl;
    let clientConfig: TestCacheImpl;

    beforeEach(async () => {
        const ctx = await setupTestApp(SearchService);
        sqlite = ctx.sqlite;
        env = ctx.env;
        app = ctx.app;
        cache = ctx.cache;
        clientConfig = ctx.clientConfig;

        await createTestUser(sqlite);
        await clientConfig.set('cache.enabled', true);
    });

    afterEach(() => {
        cleanupTestDB(sqlite);
    });

    it('should cache only published listed search results for public users', async () => {
        sqlite.exec(`
            INSERT INTO feeds (id, title, content, summary, uid, listed, draft)
            VALUES
                (1, 'Public needle', 'Public searchable content', '', 1, 1, 0),
                (2, 'Draft needle', 'Draft private searchable content', '', 1, 1, 1),
                (3, 'Unlisted needle', 'Unlisted private searchable content', '', 1, 0, 0)
        `);

        const res = await app.request('/needle?page=1&limit=10', { method: 'GET' }, env);

        expect(res.status).toBe(200);
        const data = await res.json() as any;
        expect(data.size).toBe(1);
        expect(data.data.map((item: any) => item.title)).toEqual(['Public needle']);

        const entries = await cache.all();
        expect(entries.has('public_search_needle')).toBe(true);

        const serializedCache = JSON.stringify(Object.fromEntries(entries));
        expect(serializedCache).toContain('Public needle');
        expect(serializedCache).not.toContain('Draft private searchable content');
        expect(serializedCache).not.toContain('Unlisted private searchable content');
        expect(serializedCache).not.toContain('"draft"');
        expect(serializedCache).not.toContain('"listed"');
    });
});
