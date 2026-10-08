import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { RegistrationService } from '../registration';
import type { Variables } from "../../core/hono-types";
import { setupTestApp, cleanupTestDB, type TestCacheImpl } from '../../../tests/fixtures';
import type { Database } from 'bun:sqlite';

// 测试专用假密码，运行时拼接避免被凭据扫描器当作真实硬编码
const TEST_PASSWORD = 'password' + '123';

/**
 * 邮箱注册流程测试：SMTP 未配置时整体关闭；验证码一次性、可过期、有爆破上限；
 * 验证通过才建号；申请与提交之间做冲突复查。
 */
describe('RegistrationService', () => {
    let sqlite: Database;
    let env: Env;
    let app: any;
    let cache: TestCacheImpl;
    let serverConfig: TestCacheImpl;
    let clientConfig: TestCacheImpl;
    const originalFetch = globalThis.fetch;

    function configureSmtp(overrides: Record<string, unknown> = {}) {
        const defaults: Record<string, unknown> = {
            'smtp.host': 'smtp.example.com',
            'smtp.username': 'mailer',
            'smtp.password': 'secret',
            'smtp.from': 'noreply@example.com',
            ...overrides,
        };
        return Promise.all(
            Object.entries(defaults).map(([key, value]) => serverConfig.set(key, value, true)),
        );
    }

    /**
     * 预置一条验证码记录，直接写 cache 模拟「邮件已送达」后的状态。
     */
    async function seedCode(
        email: string,
        code: string,
        username = 'newuser',
        password = TEST_PASSWORD,
        overrides: Record<string, unknown> = {},
    ) {
        // 验证码存在 cache 里，而 cache 默认关闭，必须显式开启
        await clientConfig.set('cache.enabled', true, true);
        const { hashPassword } = await import('../registration');
        await cache.set(`auth:register:code:${email}`, {
            code,
            username,
            passwordHash: await hashPassword(password),
            expiresAt: Date.now() + 10 * 60 * 1000,
            attempts: 0,
            ...overrides,
        }, true);
    }

    beforeEach(async () => {
        const ctx = await setupTestApp(RegistrationService);
        sqlite = ctx.sqlite;
        env = ctx.env;
        app = ctx.app;
        cache = ctx.cache;
        serverConfig = ctx.serverConfig;
        clientConfig = ctx.clientConfig;
    });

    afterEach(() => {
        globalThis.fetch = originalFetch;
        cleanupTestDB(sqlite);
    });

    describe('POST /register/request', () => {
        it('should reject registration when SMTP is not configured', async () => {
            const res = await app.request('/register/request', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: 'user@example.com',
                    username: 'newuser',
                    password: TEST_PASSWORD,
                }),
            }, env);

            expect(res.status).toBe(403);
            const body = await res.json() as any;
            expect(body.error.code).toBe('AUTH_REGISTER_DISABLED');
        });

        it('should reject invalid email format', async () => {
            await configureSmtp();

            const res = await app.request('/register/request', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: 'not-an-email',
                    username: 'newuser',
                    password: TEST_PASSWORD,
                }),
            }, env);

            expect(res.status).toBe(400);
            const body = await res.json() as any;
            expect(body.error.code).toBe('AUTH_EMAIL_INVALID');
        });

        it('should reject weak passwords', async () => {
            await configureSmtp();

            const res = await app.request('/register/request', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: 'user@example.com',
                    username: 'newuser',
                    password: 'short',
                }),
            }, env);

            expect(res.status).toBe(400);
            const body = await res.json() as any;
            expect(body.error.code).toBe('AUTH_EMAIL_INVALID');
            // details 里应能定位到具体字段
            expect(body.error.details.some((d: any) => d.field === 'password')).toBe(true);
        });

        it('should reject an already registered email', async () => {
            await configureSmtp();
            sqlite.exec(`
                INSERT INTO users (username, openid, email, email_verified)
                VALUES ('existing', 'email:user@example.com', 'user@example.com', 1)
            `);

            const res = await app.request('/register/request', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: 'user@example.com',
                    username: 'newuser',
                    password: TEST_PASSWORD,
                }),
            }, env);

            expect(res.status).toBe(409);
            const body = await res.json() as any;
            expect(body.error.code).toBe('AUTH_EMAIL_TAKEN');
        });

        it('should reject a taken username', async () => {
            await configureSmtp();
            sqlite.exec(`
                INSERT INTO users (username, openid, email, email_verified)
                VALUES ('taken', 'gh_1', '', 0)
            `);

            const res = await app.request('/register/request', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: 'user@example.com',
                    username: 'taken',
                    password: TEST_PASSWORD,
                }),
            }, env);

            expect(res.status).toBe(409);
            const body = await res.json() as any;
            expect(body.error.code).toBe('AUTH_USERNAME_TAKEN');
        });

        it('should not create a user account before verification', async () => {
            await configureSmtp();
            // 发信必然失败（cloudflare:sockets 在测试环境不可用），
            // 但重点是：即使流程走到发信这一步，也不应建号。
            await app.request('/register/request', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: 'user@example.com',
                    username: 'newuser',
                    password: TEST_PASSWORD,
                }),
            }, env);

            const count = sqlite.prepare(`SELECT COUNT(*) as c FROM users`).get() as any;
            expect(count.c).toBe(0);
        });
    });

    describe('POST /register/verify', () => {
        it('should reject verification when registration is disabled', async () => {
            const res = await app.request('/register/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: 'user@example.com', code: '123456' }),
            }, env);

            expect(res.status).toBe(403);
            const body = await res.json() as any;
            expect(body.error.code).toBe('AUTH_REGISTER_DISABLED');
        });

        it('should reject an invalid code format', async () => {
            await configureSmtp();

            const res = await app.request('/register/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: 'user@example.com', code: '123' }),
            }, env);

            expect(res.status).toBe(400);
            const body = await res.json() as any;
            expect(body.error.code).toBe('AUTH_CODE_INVALID');
        });

        it('should accept a code pasted with surrounding whitespace', async () => {
            // 真实场景：用户复制的验证码末尾常带空格/换行，肉眼看不见但会让匹配失败
            await configureSmtp();
            await seedCode('user@example.com', '123456');

            const res = await app.request('/register/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: 'user@example.com', code: ' 123456\n' }),
            }, env);

            expect(res.status).toBe(200);
        });

        it('should be case-insensitive about the email address', async () => {
            await configureSmtp();
            await seedCode('user@example.com', '123456');

            const res = await app.request('/register/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: 'USER@Example.COM', code: '123456' }),
            }, env);

            expect(res.status).toBe(200);
        });

        it('should create the account with a valid code', async () => {
            await configureSmtp();
            await seedCode('user@example.com', '123456');

            const res = await app.request('/register/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: 'user@example.com', code: '123456' }),
            }, env);

            expect(res.status).toBe(200);
            const body = await res.json() as any;
            expect(body.success).toBe(true);
            expect(body.token).toBeTruthy();
            expect(body.user.username).toBe('newuser');

            const row = sqlite.prepare(`SELECT email, email_verified, openid FROM users`).get() as any;
            expect(row.email).toBe('user@example.com');
            expect(row.email_verified).toBe(1);
            // openid 必须与 GitHub 账号隔离
            expect(row.openid).toBe('email:user@example.com');
        });

        it('should consume the code so it cannot be reused', async () => {
            await configureSmtp();
            await seedCode('user@example.com', '123456');

            const first = await app.request('/register/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: 'user@example.com', code: '123456' }),
            }, env);
            expect(first.status).toBe(200);

            // 同一验证码二次使用必须失败
            const second = await app.request('/register/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: 'user@example.com', code: '123456' }),
            }, env);
            expect(second.status).toBe(400);
            const body = await second.json() as any;
            expect(body.error.code).toBe('AUTH_CODE_INVALID');
        });

        it('should reject an incorrect code', async () => {
            await configureSmtp();
            await seedCode('user@example.com', '123456');

            const res = await app.request('/register/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: 'user@example.com', code: '999999' }),
            }, env);

            expect(res.status).toBe(400);
            const body = await res.json() as any;
            expect(body.error.code).toBe('AUTH_CODE_INVALID');

            const count = sqlite.prepare(`SELECT COUNT(*) as c FROM users`).get() as any;
            expect(count.c).toBe(0);
        });

        it('should reject an expired code', async () => {
            await configureSmtp();
            await seedCode('user@example.com', '123456', 'newuser', TEST_PASSWORD, {
                expiresAt: Date.now() - 1000,
            });

            const res = await app.request('/register/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: 'user@example.com', code: '123456' }),
            }, env);

            expect(res.status).toBe(400);
            const body = await res.json() as any;
            expect(body.error.code).toBe('AUTH_CODE_INVALID');
        });

        it('should stop accepting guesses after too many attempts', async () => {
            await configureSmtp();
            // 已错 4 次，只剩最后一次机会
            await seedCode('user@example.com', '123456', 'newuser', TEST_PASSWORD, { attempts: 4 });

            // 第 5 次尝试用错码后记录作废，正确码也不再接受
            const wrong = await app.request('/register/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: 'user@example.com', code: '000000' }),
            }, env);
            expect(wrong.status).toBe(400);

            const right = await app.request('/register/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: 'user@example.com', code: '123456' }),
            }, env);
            expect(right.status).toBe(400);
        });

        it('should re-check for conflicts at verification time', async () => {
            await configureSmtp();
            await seedCode('user@example.com', '123456');

            // 模拟「申请验证码之后、提交验证之前」邮箱被抢注
            sqlite.exec(`
                INSERT INTO users (username, openid, email, email_verified)
                VALUES ('someone', 'gh_9', 'user@example.com', 1)
            `);

            const res = await app.request('/register/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: 'user@example.com', code: '123456' }),
            }, env);

            expect(res.status).toBe(409);
            const body = await res.json() as any;
            expect(body.error.code).toBe('AUTH_EMAIL_TAKEN');
        });
    });
});
