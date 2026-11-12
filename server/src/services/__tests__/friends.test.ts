import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { FriendService } from '../friends';
import { Hono } from "hono";
import type { Variables } from "../../core/hono-types";
import { setupTestApp, cleanupTestDB } from '../../../tests/fixtures';
import type { Database } from 'bun:sqlite';

describe('FriendService', () => {
    let db: any;
    let sqlite: Database;
    let env: Env;
    let app: Hono<{ Bindings: Env; Variables: Variables }>;

    beforeEach(async () => {
        const ctx = await setupTestApp(FriendService);
        db = ctx.db;
        sqlite = ctx.sqlite;
        env = ctx.env;
        app = ctx.app;

        // Create test users
        await createTestUsers();
    });

    afterEach(() => {
        cleanupTestDB(sqlite);
    });

    async function createTestUsers() {
        sqlite.exec(`
            INSERT INTO users (id, username, openid, avatar, permission) 
            VALUES (1, 'admin', 'gh_admin', 'admin.png', 1)
        `);
        sqlite.exec(`
            INSERT INTO users (id, username, openid, avatar, permission) 
            VALUES (2, 'regular', 'gh_regular', 'regular.png', 0)
        `);
    }

    describe('URL boundary for server-side health checks', () => {
        function post(body: Record<string, unknown>) {
            return app.request('/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer mock_token_2',
                },
                body: JSON.stringify(body),
            }, env);
        }

        const validBase = { name: 'Friend', desc: 'Desc', avatar: 'avatar.png' };

        it('should accept a normal https URL', async () => {
            const res = await post({ ...validBase, url: 'https://friend.example/blog' });
            expect(res.status).toBe(200);
        });

        it('should accept a normal http URL', async () => {
            const res = await post({ ...validBase, url: 'http://friend.example/' });
            expect(res.status).toBe(200);
        });

        it('should reject non-http(s) schemes before they reach the crontab', async () => {
            for (const url of ['file:///etc/passwd', 'ftp://example.com/x', 'javascript:alert(1)']) {
                const res = await post({ ...validBase, url });
                expect(res.status).toBe(400);
                expect(await res.text()).toBe('Invalid friend url');
            }
        });

        it('should reject malformed URLs and non-string values', async () => {
            for (const url of ['not-a-url', '://missing-scheme', 123]) {
                const res = await post({ ...validBase, url });
                expect(res.status).toBe(400);
            }
        });
    });

    describe('GET / - List friends', () => {
        it('should return only accepted friends for non-admin', async () => {
            sqlite.exec(`
                INSERT INTO friends (id, name, desc, avatar, url, uid, accepted, sort_order) VALUES 
                (1, 'Friend 1', 'Desc 1', 'avatar1.png', 'https://friend1.com', 2, 1, 0),
                (2, 'Friend 2', 'Desc 2', 'avatar2.png', 'https://friend2.com', 2, 0, 0)
            `);

            const res = await app.request('/', { method: 'GET' }, env);

            expect(res.status).toBe(200);
            const data = await res.json() as any;
            expect(data.friend_list).toBeArray();
            expect(data.friend_list.length).toBe(1);
            expect(data.friend_list[0].name).toBe('Friend 1');
        });

        it('should return all friends for admin', async () => {
            sqlite.exec(`
                INSERT INTO friends (id, name, desc, avatar, url, uid, accepted, sort_order) VALUES 
                (1, 'Friend 1', 'Desc 1', 'avatar1.png', 'https://friend1.com', 2, 1, 0),
                (2, 'Friend 2', 'Desc 2', 'avatar2.png', 'https://friend2.com', 2, 0, 0)
            `);

            const res = await app.request('/', {
                method: 'GET',
                headers: { 'Authorization': 'Bearer mock_token_1' },
            }, env);

            expect(res.status).toBe(200);
            const data = await res.json() as any;
            expect(data.friend_list.length).toBe(2);
        });

        it('should return empty list when no friends exist', async () => {
            const res = await app.request('/', { method: 'GET' }, env);

            expect(res.status).toBe(200);
            const data = await res.json() as any;
            expect(data.friend_list).toEqual([]);
        });
    });

    describe('POST / - Create friend', () => {
        it('should require authentication', async () => {
            const res = await app.request('/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: 'New Friend',
                    desc: 'Description',
                    avatar: 'avatar.png',
                    url: 'https://example.com'
                }),
            }, env);

            expect(res.status).toBe(401);
        });

        it('should allow admin to create friend directly', async () => {
            const res = await app.request('/', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer mock_token_1',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: 'New Friend',
                    desc: 'Description',
                    avatar: 'avatar.png',
                    url: 'https://example.com'
                }),
            }, env);

            expect(res.status).toBe(200);
        });

        it('should validate input length', async () => {
            const res = await app.request('/', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer mock_token_1',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: 'a'.repeat(21),
                    desc: 'Description',
                    avatar: 'avatar.png',
                    url: 'https://example.com'
                }),
            }, env);

            expect(res.status).toBe(400);
        });

        it('should require all fields', async () => {
            const res = await app.request('/', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer mock_token_1',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: '',
                    desc: '',
                    avatar: '',
                    url: ''
                }),
            }, env);

            expect(res.status).toBe(400);
        });
    });

    describe('PUT /:id - Update friend', () => {
        beforeEach(() => {
            sqlite.exec(`
                INSERT INTO friends (id, name, desc, avatar, url, uid, accepted, sort_order) VALUES 
                (1, 'Original Name', 'Original Desc', 'avatar.png', 'https://example.com', 2, 0, 0)
            `);
        });

        it('should require authentication', async () => {
            const res = await app.request('/1', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: 'Updated Name',
                    desc: 'Updated Desc',
                    url: 'https://example.com'
                }),
            }, env);

            expect(res.status).toBe(401);
        });

        it('should allow admin to update any friend', async () => {
            const res = await app.request('/1', {
                method: 'PUT',
                headers: {
                    'Authorization': 'Bearer mock_token_1',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: 'Updated Name',
                    desc: 'Updated Desc',
                    url: 'https://new-example.com',
                    accepted: 1
                }),
            }, env);

            expect(res.status).toBe(200);
        });

        const invalidUrls = [
            'file:///etc/passwd',
            'ftp://example.com/x',
            'javascript:alert(1)',
            '/relative/path',
            '//example.com/path',
            'not-a-url',
            'https://',
            123,
            false,
            { url: 'https://example.com' },
            ['https://example.com'],
        ];

        for (const token of ['mock_token_1', 'mock_token_2']) {
            it(`should reject invalid URLs without updating the friend for ${token}`, async () => {
                const original = sqlite.prepare('SELECT * FROM friends WHERE id = 1').get();

                for (const url of invalidUrls) {
                    const res = await app.request('/1', {
                        method: 'PUT',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ name: 'Must not update', url }),
                    }, env);

                    expect(res.status).toBe(400);
                    expect(await res.text()).toBe('Invalid friend url');
                    expect(sqlite.prepare('SELECT * FROM friends WHERE id = 1').get()).toEqual(original);
                }
            });
        }

        it('should return 404 for non-existent friend', async () => {
            const res = await app.request('/999', {
                method: 'PUT',
                headers: {
                    'Authorization': 'Bearer mock_token_1',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: 'Updated Name',
                    desc: 'Updated Desc',
                    url: 'https://example.com'
                }),
            }, env);

            expect(res.status).toBe(404);
        });
    });

    describe('DELETE /:id - Delete friend', () => {
        beforeEach(() => {
            sqlite.exec(`
                INSERT INTO friends (id, name, desc, avatar, url, uid, accepted) VALUES 
                (1, 'Friend Name', 'Desc', 'avatar.png', 'https://example.com', 2, 1)
            `);
        });

        it('should require authentication', async () => {
            const res = await app.request('/1', { method: 'DELETE' }, env);

            expect(res.status).toBe(401);
        });

        it('should allow admin to delete any friend', async () => {
            const res = await app.request('/1', {
                method: 'DELETE',
                headers: { 'Authorization': 'Bearer mock_token_1' },
            }, env);

            expect(res.status).toBe(200);

            // Verify deletion
            const friend = sqlite.prepare('SELECT * FROM friends WHERE id = 1').get();
            expect(friend).toBeNull();
        });

        it('should return 404 for non-existent friend', async () => {
            const res = await app.request('/999', {
                method: 'DELETE',
                headers: { 'Authorization': 'Bearer mock_token_1' },
            }, env);

            expect(res.status).toBe(404);
        });
    });
});
