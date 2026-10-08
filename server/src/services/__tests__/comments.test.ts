import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import { CommentService } from '../comments';
import { Hono } from "hono";
import type { Variables } from "../../core/hono-types";
import { setupTestApp, cleanupTestDB, TestCacheImpl } from '../../../tests/fixtures';
import type { Database } from 'bun:sqlite';

describe('CommentService', () => {
    let db: any;
    let sqlite: Database;
    let env: Env;
    let app: Hono<{ Bindings: Env; Variables: Variables }>;
    let serverConfig: TestCacheImpl;
    let clientConfig: TestCacheImpl;
    const originalFetch = globalThis.fetch;

    beforeEach(async () => {
        const ctx = await setupTestApp(CommentService);
        db = ctx.db;
        sqlite = ctx.sqlite;
        env = ctx.env;
        app = ctx.app;
        serverConfig = ctx.serverConfig;
        clientConfig = ctx.clientConfig;

        // Seed test data
        await seedTestData(sqlite);
    });

    afterEach(() => {
        globalThis.fetch = originalFetch;
        cleanupTestDB(sqlite);
    });

    async function seedTestData(sqlite: Database) {
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

        // Insert test comments
        sqlite.exec(`
            INSERT INTO comments (id, feed_id, user_id, content, created_at) VALUES 
                (1, 1, 2, 'Comment 1 on feed 1', unixepoch()),
                (2, 1, 2, 'Comment 2 on feed 1', unixepoch()),
                (3, 2, 1, 'Comment on feed 2', unixepoch())
        `);
    }

    describe('GET /:feed - List comments', () => {
        it('should return comments for a feed', async () => {
            const res = await app.request('/1', { method: 'GET' }, env);
            
            expect(res.status).toBe(200);
            const data = await res.json() as any;
            expect(data).toBeArray();
            expect(data.length).toBe(2);
            expect(data[0]).toHaveProperty('content');
            expect(data[0]).toHaveProperty('user');
            expect(data[0].user).toHaveProperty('username');
        });

        it('should return empty array when feed has no comments', async () => {
            // Create new feed without comments
            sqlite.exec(`INSERT INTO feeds (id, title, content, uid) VALUES (3, 'No Comments', 'Content', 1)`);
            
            const res = await app.request('/3', { method: 'GET' }, env);
            
            expect(res.status).toBe(200);
            const data = await res.json() as any;
            expect(data).toEqual([]);
        });

        it('should not expose sensitive fields', async () => {
            const res = await app.request('/1', { method: 'GET' }, env);
            
            expect(res.status).toBe(200);
            const data = await res.json() as any;
            expect(data.length).toBeGreaterThan(0);
            
            // Should not include feedId and userId (excluded in query)
            expect(data[0]).not.toHaveProperty('feedId');
            expect(data[0]).not.toHaveProperty('userId');
            
            // Should include user info
            expect(data[0].user).toHaveProperty('id');
            expect(data[0].user).toHaveProperty('username');
            expect(data[0].user).toHaveProperty('avatar');
            expect(data[0].user).toHaveProperty('permission');
        });

        it('should order comments by createdAt descending', async () => {
            const res = await app.request('/1', { method: 'GET' }, env);
            
            expect(res.status).toBe(200);
            const data = await res.json() as any;
            expect(data.length).toBe(2);
        });
    });

    describe('POST /:feed - Create comment', () => {
        it('should create comment with authenticated user', async () => {
            const res = await app.request('/1', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer mock_token_1',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ content: 'New test comment' }),
            }, env);

            // 201 Created：创建资源应返回 201 而非 200
            expect(res.status).toBe(201);

            // Verify comment was created
            const comments = sqlite.prepare(`SELECT * FROM comments WHERE feed_id = 1`).all();
            expect(comments.length).toBe(3);
        });

        it('should put authenticated user comments into moderation by default', async () => {
            // 行为变更：登录用户不再自动免审。
            // 开了人机验证说明有人在刷，登录只证明是个真实账号，不代表评论可信。
            const res = await app.request('/1', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer mock_token_1',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ content: 'Auto approved' }),
            }, env);

            expect(res.status).toBe(201);
            const body = await res.json() as any;
            expect(body.approved).toBe(false);
        });

        it('should auto-approve authenticated users when moderate_user is disabled', async () => {
            await serverConfig.set('comment.moderate_user', false, true);

            const res = await app.request('/1', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer mock_token_1',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ content: 'Skip review' }),
            }, env);

            expect(res.status).toBe(201);
            const body = await res.json() as any;
            expect(body.approved).toBe(true);
        });

        it('should create guest comment with guestName', async () => {
            const res = await app.request('/1', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    content: 'Guest comment',
                    guestName: 'Visitor',
                    guestEmail: 'visitor@example.com',
                    guestWebsite: 'https://example.com',
                }),
            }, env);

            expect(res.status).toBe(201);

            // Verify via direct DB query
            const row = sqlite.prepare(
                `SELECT content, guest_name, guest_email, guest_website, approved FROM comments WHERE guest_name = 'Visitor'`
            ).get() as any;
            expect(row).toBeDefined();
            expect(row.content).toBe('Guest comment');
            expect(row.guest_name).toBe('Visitor');
            expect(row.guest_email).toBe('visitor@example.com');
            expect(row.guest_website).toBe('https://example.com');
            // 游客评论默认进入待审核队列
            expect(row.approved).toBe(0);
        });

        it('should reject guest comment without guestName', async () => {
            const res = await app.request('/1', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: 'Guest no name' }),
            }, env);
            expect(res.status).toBe(400);
            const body = await res.json() as any;
            expect(body.error.code).toBe('COMMENT_GUEST_NAME_REQUIRED');
        });

        it('should reject guest comments when guest comments are disabled server-side', async () => {
            // 开关存放在 client config（后台设置页写入的位置），服务端从这里读取并强制校验
            await clientConfig.set('comment.guest.enabled', false, true);

            const res = await app.request('/1', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: 'Blocked guest', guestName: 'Guest' }),
            }, env);

            expect(res.status).toBe(403);
            const body = await res.json() as any;
            expect(body.error.code).toBe('COMMENT_GUEST_DISABLED');
        });

        it('should auto-approve guest comments when moderation is disabled', async () => {
            await serverConfig.set('comment.moderate_guest', false, true);

            const res = await app.request('/1', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: 'No review needed', guestName: 'Guest' }),
            }, env);

            expect(res.status).toBe(201);
            const body = await res.json() as any;
            expect(body.approved).toBe(true);
        });

        it('should hide unapproved guest comments from anonymous readers', async () => {
            // 游客评论默认待审核，因此不应出现在匿名列表里
            const res = await app.request('/1', { method: 'GET' }, env);

            expect(res.status).toBe(200);
            const data = await res.json() as any[];
            // 种子里两条评论都是登录用户（approved 默认为 1），游客评论不计入
            expect(data.every((c: any) => c.approved === true)).toBe(true);
        });

        it('should return 400 when not authenticated and guest name missing', async () => {
            const res = await app.request('/1', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: 'Test comment' }),
            }, env);

            expect(res.status).toBe(400);
            const body = await res.json() as any;
            expect(body.error.code).toBe('COMMENT_GUEST_NAME_REQUIRED');
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
            const body = await res.json() as any;
            expect(body.error.code).toBe('COMMENT_CONTENT_REQUIRED');
        });

        it('should reject overly long content', async () => {
            const res = await app.request('/1', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer mock_token_1',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ content: 'a'.repeat(2001) }),
            }, env);

            expect(res.status).toBe(400);
            const body = await res.json() as any;
            expect(body.error.code).toBe('COMMENT_CONTENT_TOO_LONG');
        });

        it('should return 401 for non-existent user token', async () => {
            const res = await app.request('/1', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer mock_token_999',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ content: 'Test' }),
            }, env);

            // token 指向不存在的用户，属于未授权而非请求格式错误
            expect(res.status).toBe(401);
            const body = await res.json() as any;
            expect(body.error.code).toBe('LOGIN_REQUIRED');
        });

        it('should return 404 for non-existent feed', async () => {
            const res = await app.request('/999', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer mock_token_1',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ content: 'Test' }),
            }, env);

            // 目标资源不存在是 404，不是 400
            expect(res.status).toBe(404);
            const body = await res.json() as any;
            expect(body.error.code).toBe('COMMENT_FEED_NOT_FOUND');
        });

        it('should still create the comment when webhook delivery fails', async () => {
            env.WEBHOOK_URL = 'not-a-valid-url' as any;
            globalThis.fetch = mock(async () => {
                throw new TypeError('Invalid URL');
            }) as typeof fetch;

            const res = await app.request('/1', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer mock_token_1',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ content: 'Comment survives webhook errors' }),
            }, env);

            expect(res.status).toBe(201);

            const comments = sqlite.prepare(`SELECT * FROM comments WHERE feed_id = 1`).all();
            expect(comments.length).toBe(3);
        });

        it('should rate limit guest comments on the same feed', async () => {
            // 限流走 cache，而 cache 在测试环境默认关闭（cache.enabled=false），
            // 必须显式开启才能验证限流行为
            await clientConfig.set('cache.enabled', true, true);

            // 频率限制：同一 feed 每分钟最多 5 条游客评论
            for (let i = 0; i < 5; i++) {
                const res = await app.request('/1', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ content: `spam ${i}`, guestName: 'Spammer' }),
                }, env);
                expect(res.status).toBe(201);
            }

            const blocked = await app.request('/1', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: 'one too many', guestName: 'Spammer' }),
            }, env);

            expect(blocked.status).toBe(429);
            const body = await blocked.json() as any;
            expect(body.error.code).toBe('RATE_LIMITED');
        });
    });

    describe('DELETE /:id - Delete comment', () => {
        it('should allow user to delete their own comment', async () => {
            const res = await app.request('/1', {
                method: 'DELETE',
                headers: { 'Authorization': 'Bearer mock_token_2' },
            }, env);

            expect(res.status).toBe(200);
            
            // Verify comment was deleted
            const dbResult = sqlite.prepare(`SELECT * FROM comments WHERE id = 1`).all();
            expect(dbResult.length).toBe(0);
        });

        it('should allow admin to delete any comment', async () => {
            const res = await app.request('/1', {
                method: 'DELETE',
                headers: { 'Authorization': 'Bearer mock_token_3' },
            }, env);

            expect(res.status).toBe(200);
        });

        it('should deny deletion by other users', async () => {
            const res = await app.request('/1', {
                method: 'DELETE',
                headers: { 'Authorization': 'Bearer mock_token_1' },
            }, env);

            expect(res.status).toBe(403);
        });

        it('should require authentication', async () => {
            const res = await app.request('/1', { method: 'DELETE' }, env);

            expect(res.status).toBe(401);
        });

        it('should return 404 for non-existent comment', async () => {
            const res = await app.request('/999', {
                method: 'DELETE',
                headers: { 'Authorization': 'Bearer mock_token_1' },
            }, env);

            expect(res.status).toBe(404);
            const body = await res.json() as any;
            expect(body.error.code).toBe('COMMENT_NOT_FOUND');
        });
    });

    describe('Comment deletion', () => {
        beforeEach(() => {
            sqlite.exec(`
                INSERT INTO comments (id, feed_id, user_id, content, guest_name, approved, created_at)
                VALUES (60, 1, NULL, 'spam to delete', 'Spammer', 0, 1000);
            `);
        });

        it('should let an admin permanently delete any comment', async () => {
            // 「驳回」只把 approved 置 0，行还在库里占空间；
            // 真正释放空间必须走删除。管理员应能删任意评论。
            const res = await app.request('/60', {
                method: 'DELETE',
                headers: { 'Authorization': 'Bearer mock_token_3' },
            }, env);

            expect(res.status).toBe(200);
            const remaining = sqlite
                .prepare('SELECT COUNT(*) as c FROM comments WHERE id = 60')
                .get() as any;
            expect(remaining.c).toBe(0);
        });

        it('should reject an anonymous caller', async () => {
            const res = await app.request('/60', { method: 'DELETE' }, env);
            expect(res.status).toBe(401);

            const remaining = sqlite
                .prepare('SELECT COUNT(*) as c FROM comments WHERE id = 60')
                .get() as any;
            expect(remaining.c).toBe(1);
        });

        it('should reject a non-owner non-admin', async () => {
            // 用户 2 不是这条评论的作者（user_id 为 NULL，属游客）
            const res = await app.request('/60', {
                method: 'DELETE',
                headers: { 'Authorization': 'Bearer mock_token_2' },
            }, env);

            expect(res.status).toBe(403);
            const remaining = sqlite
                .prepare('SELECT COUNT(*) as c FROM comments WHERE id = 60')
                .get() as any;
            expect(remaining.c).toBe(1);
        });

        it('should return 404 for a non-existent comment', async () => {
            const res = await app.request('/9999', {
                method: 'DELETE',
                headers: { 'Authorization': 'Bearer mock_token_3' },
            }, env);

            expect(res.status).toBe(404);
        });
    });

    describe('Comment moderation', () => {
        beforeEach(() => {
            // 插入一条待审核的游客评论
            sqlite.exec(`
                INSERT INTO comments (id, feed_id, user_id, content, guest_name, approved, created_at)
                VALUES (10, 1, NULL, 'Pending guest comment', 'Visitor', 0, unixepoch())
            `);
        });

        it('should hide unapproved comments from anonymous readers', async () => {
            const res = await app.request('/1', { method: 'GET' }, env);

            expect(res.status).toBe(200);
            const data = await res.json() as any[];
            expect(data.find((c: any) => c.id === 10)).toBeUndefined();
        });

        it('should show unapproved comments to admins', async () => {
            // mock_token_3 对应 permission = 1 的 admin
            const res = await app.request('/1', {
                method: 'GET',
                headers: { 'Authorization': 'Bearer mock_token_3' },
            }, env);

            expect(res.status).toBe(200);
            const data = await res.json() as any[];
            const pending = data.find((c: any) => c.id === 10);
            expect(pending).toBeDefined();
            expect(pending.approved).toBe(false);
        });

        it('should list pending comments for admins only', async () => {
            const forbidden = await app.request('/pending', { method: 'GET' }, env);
            expect(forbidden.status).toBe(401);

            const res = await app.request('/pending', {
                method: 'GET',
                headers: { 'Authorization': 'Bearer mock_token_3' },
            }, env);

            expect(res.status).toBe(200);
            // 响应现在是分页结构：{ comments, pagination }
            const body = await res.json() as any;
            expect(body.comments.length).toBe(1);
            expect(body.comments[0].id).toBe(10);
            expect(body.comments[0].feedTitle).toBe('Feed 1');
            expect(body.pagination.total).toBe(1);
        });

        it('should support filtering by approved state', async () => {
            // approved 筛选：种子里 id=10 是待审，其余为已通过
            const res = await app.request('/pending?filter=approved', {
                method: 'GET',
                headers: { 'Authorization': 'Bearer mock_token_3' },
            }, env);

            expect(res.status).toBe(200);
            const body = await res.json() as any;
            expect(body.comments.every((c: any) => c.approved === true)).toBe(true);
            expect(body.comments.find((c: any) => c.id === 10)).toBeUndefined();
        });

        it('should return both pending and approved when filter=all', async () => {
            const res = await app.request('/pending?filter=all', {
                method: 'GET',
                headers: { 'Authorization': 'Bearer mock_token_3' },
            }, env);

            expect(res.status).toBe(200);
            const body = await res.json() as any;
            expect(body.comments.some((c: any) => c.approved === false)).toBe(true);
            expect(body.comments.some((c: any) => c.approved === true)).toBe(true);
        });

        it('should fall back to pending for an unknown filter', async () => {
            // 拼错 filter 时不能退化成「返回全部」，否则会绕过审核视角
            const res = await app.request('/pending?filter=bogus', {
                method: 'GET',
                headers: { 'Authorization': 'Bearer mock_token_3' },
            }, env);

            expect(res.status).toBe(200);
            const body = await res.json() as any;
            expect(body.comments.every((c: any) => c.approved === false)).toBe(true);
        });

        it('should include the author username in the moderation list', async () => {
            // 回归：/pending 查询漏了 user 关联，导致后台里所有评论都显示「匿名」，
            // 管理员根本无法判断是谁发的、要不要通过。
            const res = await app.request('/pending?filter=all', {
                method: 'GET',
                headers: { 'Authorization': 'Bearer mock_token_3' },
            }, env);

            expect(res.status).toBe(200);
            const body = await res.json() as any;

            // 种子里的评论属于用户 1 / 2，应当带上 username
            const withUser = body.comments.find((c: any) => c.user);
            expect(withUser).toBeDefined();
            expect(withUser.user.username).toBeTruthy();

            // 不能再有「登录用户的评论却查不到 user」的情况
            const loggedIn = body.comments.filter((c: any) => c.userId !== null);
            expect(loggedIn.length).toBeGreaterThan(0);
            for (const comment of loggedIn) {
                expect(comment.user).not.toBeNull();
                expect(comment.user.username).toBeTruthy();
            }
        });

        it('should approve a pending comment', async () => {
            const res = await app.request('/10/approved', {
                method: 'PUT',
                headers: {
                    'Authorization': 'Bearer mock_token_3',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ approved: true }),
            }, env);

            expect(res.status).toBe(200);
            const body = await res.json() as any;
            expect(body.approved).toBe(true);

            const row = sqlite.prepare(`SELECT approved FROM comments WHERE id = 10`).get() as any;
            expect(row.approved).toBe(1);

            // 通过后匿名读者应能看到
            const list = await app.request('/1', { method: 'GET' }, env);
            const data = await list.json() as any[];
            expect(data.find((c: any) => c.id === 10)).toBeDefined();
        });

        it('should reject an approved comment', async () => {
            const res = await app.request('/1/approved', {
                method: 'PUT',
                headers: {
                    'Authorization': 'Bearer mock_token_3',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ approved: false }),
            }, env);

            expect(res.status).toBe(200);
            const row = sqlite.prepare(`SELECT approved FROM comments WHERE id = 1`).get() as any;
            expect(row.approved).toBe(0);
        });

        it('should deny moderation to non-admin users', async () => {
            const res = await app.request('/10/approved', {
                method: 'PUT',
                headers: {
                    'Authorization': 'Bearer mock_token_1',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ approved: true }),
            }, env);

            expect(res.status).toBe(401);
        });

        it('should reject invalid moderation payload', async () => {
            const res = await app.request('/10/approved', {
                method: 'PUT',
                headers: {
                    'Authorization': 'Bearer mock_token_3',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({}),
            }, env);

            expect(res.status).toBe(400);
            const body = await res.json() as any;
            expect(body.error.code).toBe('COMMENT_VALIDATION_FAILED');
        });
    });

    describe('GET /captcha - Captcha config', () => {
        it('should return disabled config when turnstile is not configured', async () => {
            const res = await app.request('/captcha', { method: 'GET' }, env);

            expect(res.status).toBe(200);
            const data = await res.json() as any;
            expect(data.enabled).toBe(false);
            expect(data.siteKey).toBe('');
        });

        it('should never expose the secret key', async () => {
            await serverConfig.set('turnstile.enabled', true, true);
            await serverConfig.set('turnstile.site_key', 'site-key-123', true);
            await serverConfig.set('turnstile.secret_key', 'super-secret', true);

            const res = await app.request('/captcha', { method: 'GET' }, env);

            expect(res.status).toBe(200);
            const raw = await res.text();
            expect(raw).not.toContain('super-secret');
            expect(raw).not.toContain('secretKey');

            const data = JSON.parse(raw);
            expect(data.enabled).toBe(true);
            expect(data.siteKey).toBe('site-key-123');
        });
    });
});
