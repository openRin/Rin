import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { MomentsService } from '../moments';
import { Hono } from "hono";
import type { Variables } from "../../core/hono-types";
import { setupTestApp, cleanupTestDB } from '../../../tests/fixtures';
import type { Database } from 'bun:sqlite';

describe('MomentsService', () => {
    let db: any;
    let sqlite: Database;
    let env: Env;
    let app: Hono<{ Bindings: Env; Variables: Variables }>;

    beforeEach(async () => {
        const ctx = await setupTestApp(MomentsService);
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

    describe('GET / - List moments', () => {
        it('should return empty list when no moments exist', async () => {
            const res = await app.request('/', { method: 'GET' }, env);

            expect(res.status).toBe(200);
            const data = await res.json() as any;
            expect(data.data).toEqual([]);
            expect(data.hasNext).toBe(false);
            expect(data.size).toBe(0);
        });

        it('should return paginated moments', async () => {
            sqlite.exec(`
                INSERT INTO moments (id, content, uid, created_at, updated_at) VALUES 
                (1, 'Moment 1', 1, unixepoch(), unixepoch()),
                (2, 'Moment 2', 1, unixepoch(), unixepoch()),
                (3, 'Moment 3', 1, unixepoch(), unixepoch())
            `);

            const res = await app.request('/?page=1&limit=2', { method: 'GET' }, env);

            expect(res.status).toBe(200);
            const data = await res.json() as any;
            expect(data.data.length).toBe(2);
            expect(data.hasNext).toBe(true);
            expect(data.size).toBe(3);
        });

        it('should limit to maximum 50 items per page', async () => {
            const values = Array.from({ length: 55 }, (_, i) =>
                `(${i + 1}, 'Moment ${i + 1}', 1, unixepoch(), unixepoch())`
            ).join(',');
            sqlite.exec(`INSERT INTO moments (id, content, uid, created_at, updated_at) VALUES ${values}`);

            const res = await app.request('/?page=1&limit=100', { method: 'GET' }, env);

            expect(res.status).toBe(200);
            const data = await res.json() as any;
            expect(data.data.length).toBeLessThanOrEqual(50);
        });

        it('should order moments by createdAt descending', async () => {
            sqlite.exec(`
                INSERT INTO moments (id, content, uid, created_at, updated_at) VALUES 
                (1, 'Oldest', 1, unixepoch() - 100, unixepoch()),
                (2, 'Middle', 1, unixepoch() - 50, unixepoch()),
                (3, 'Newest', 1, unixepoch(), unixepoch())
            `);

            const res = await app.request('/', { method: 'GET' }, env);

            expect(res.status).toBe(200);
            const data = await res.json() as any;
            expect(data.data[0].content).toBe('Newest');
            expect(data.data[2].content).toBe('Oldest');
        });
    });

    describe('POST / - Create moment', () => {
        it('should require authentication', async () => {
            const res = await app.request('/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: 'Test moment' }),
            }, env);

            expect(res.status).toBe(401);
        });

        it('should allow admin to create moment', async () => {
            const res = await app.request('/', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer mock_token_1',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ content: 'Test moment content' }),
            }, env);

            expect(res.status).toBe(200);
            const data = await res.json() as any;
            expect(data.insertedId).toBeNumber();
        });

        it('should require content', async () => {
            const res = await app.request('/', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer mock_token_1',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ content: '' }),
            }, env);

            expect(res.status).toBe(400);
        });
    });

    describe('POST /:id - Update moment', () => {
        beforeEach(() => {
            sqlite.exec(`
                INSERT INTO moments (id, content, uid, created_at, updated_at) VALUES 
                (1, 'Original content', 1, unixepoch(), unixepoch())
            `);
        });

        it('should require authentication', async () => {
            const res = await app.request('/1', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: 'Updated content' }),
            }, env);

            expect(res.status).toBe(401);
        });

        it('should allow admin to update moment', async () => {
            const res = await app.request('/1', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer mock_token_1',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ content: 'Updated content' }),
            }, env);

            expect(res.status).toBe(200);
        });

        it('should return 404 for non-existent moment', async () => {
            const res = await app.request('/999', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer mock_token_1',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ content: 'Updated content' }),
            }, env);

            expect(res.status).toBe(404);
        });

        it('should require content', async () => {
            const res = await app.request('/1', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer mock_token_1',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ content: '' }),
            }, env);

            expect(res.status).toBe(400);
        });
    });

    describe('DELETE /:id - Delete moment', () => {
        beforeEach(() => {
            sqlite.exec(`
                INSERT INTO moments (id, content, uid, created_at, updated_at) VALUES 
                (1, 'Moment to delete', 1, unixepoch(), unixepoch())
            `);
        });

        it('should require authentication', async () => {
            const res = await app.request('/1', { method: 'DELETE' }, env);

            expect(res.status).toBe(401);
        });

        it('should allow admin to delete moment', async () => {
            const res = await app.request('/1', {
                method: 'DELETE',
                headers: { 'Authorization': 'Bearer mock_token_1' },
            }, env);

            expect(res.status).toBe(200);

            // Verify deletion
            const moment = sqlite.prepare('SELECT * FROM moments WHERE id = 1').get();
            expect(moment).toBeNull();
        });

        it('should return 404 for non-existent moment', async () => {
            const res = await app.request('/999', {
                method: 'DELETE',
                headers: { 'Authorization': 'Bearer mock_token_1' },
            }, env);

            expect(res.status).toBe(404);
        });
    });
});
