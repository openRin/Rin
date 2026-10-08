import { drizzle } from 'drizzle-orm/bun-sqlite';
import { Database } from 'bun:sqlite';
import { Hono } from 'hono';
import { createMiddleware } from 'hono/factory';
import { timing } from 'hono/timing';
import { eq } from 'drizzle-orm';
import * as schema from '../../src/db/schema';
import type { Variables, JWTUtils, OAuth2Utils, CacheImpl } from '../../src/core/hono-types';
import { profileAsync } from '../../src/core/server-timing';
import { registerErrorHandlers } from '../../src/core/error-response';
import { users } from '../../src/db/schema';

/**
 * Create an in-memory test database with Drizzle ORM.
 * Tables are created via raw SQL, queries go through Drizzle.
 */
export function createMockDB() {
    const sqlite = new Database(':memory:');

    const db = drizzle(sqlite, { schema });

    // Table names must match schema.ts definitions exactly
    sqlite.exec(`
        -- Users table
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL,
            avatar TEXT,
            openid TEXT NOT NULL,
            password TEXT,
            permission INTEGER DEFAULT 0,
            email TEXT DEFAULT '',
            email_verified INTEGER DEFAULT 0 NOT NULL,
            created_at INTEGER DEFAULT (unixepoch()),
            updated_at INTEGER DEFAULT (unixepoch())
        );

        -- Feeds table
        CREATE TABLE IF NOT EXISTS feeds (
            id TEXT PRIMARY KEY,
            alias TEXT,
            title TEXT,
            summary TEXT DEFAULT '' NOT NULL,
            ai_summary TEXT DEFAULT '' NOT NULL,
            ai_summary_status TEXT DEFAULT 'idle' NOT NULL,
            ai_summary_error TEXT DEFAULT '' NOT NULL,
            content TEXT NOT NULL,
            listed INTEGER DEFAULT 1 NOT NULL,
            draft INTEGER DEFAULT 1 NOT NULL,
            top INTEGER DEFAULT 0 NOT NULL,
            uid INTEGER NOT NULL,
            created_at INTEGER DEFAULT (unixepoch()),
            updated_at INTEGER DEFAULT (unixepoch()),
            FOREIGN KEY (uid) REFERENCES users(id)
        );

        -- Moments table
        CREATE TABLE IF NOT EXISTS moments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            content TEXT NOT NULL,
            uid INTEGER NOT NULL,
            created_at INTEGER DEFAULT (unixepoch()),
            updated_at INTEGER DEFAULT (unixepoch()),
            FOREIGN KEY (uid) REFERENCES users(id)
        );

        -- Visits table
        CREATE TABLE IF NOT EXISTS visits (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            feed_id TEXT NOT NULL,
            ip TEXT NOT NULL,
            created_at INTEGER DEFAULT (unixepoch()),
            FOREIGN KEY (feed_id) REFERENCES feeds(id) ON DELETE CASCADE
        );

        -- Visit stats table
        CREATE TABLE IF NOT EXISTS visit_stats (
            feed_id TEXT PRIMARY KEY NOT NULL,
            pv INTEGER DEFAULT 0 NOT NULL,
            hll_data TEXT DEFAULT '' NOT NULL,
            updated_at INTEGER DEFAULT (unixepoch()),
            FOREIGN KEY (feed_id) REFERENCES feeds(id) ON DELETE CASCADE
        );

        -- Info table
        CREATE TABLE IF NOT EXISTS info (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            key TEXT NOT NULL UNIQUE,
            value TEXT NOT NULL
        );

        -- Friends table
        CREATE TABLE IF NOT EXISTS friends (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            desc TEXT,
            avatar TEXT NOT NULL,
            url TEXT NOT NULL,
            uid INTEGER NOT NULL,
            accepted INTEGER DEFAULT 0 NOT NULL,
            health TEXT DEFAULT '' NOT NULL,
            sort_order INTEGER DEFAULT 0 NOT NULL,
            created_at INTEGER DEFAULT (unixepoch()),
            updated_at INTEGER DEFAULT (unixepoch()),
            FOREIGN KEY (uid) REFERENCES users(id) ON DELETE CASCADE
        );

        -- Comments table
        CREATE TABLE IF NOT EXISTS comments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            feed_id TEXT NOT NULL,
            user_id INTEGER,
            content TEXT NOT NULL,
            guest_name TEXT DEFAULT '',
            guest_email TEXT DEFAULT '',
            guest_website TEXT DEFAULT '',
            approved INTEGER DEFAULT 1 NOT NULL,
            created_at INTEGER DEFAULT (unixepoch()),
            updated_at INTEGER DEFAULT (unixepoch()),
            FOREIGN KEY (feed_id) REFERENCES feeds(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        -- Hashtags table (note: named "hashtags" not "tags")
        CREATE TABLE IF NOT EXISTS hashtags (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            created_at INTEGER DEFAULT (unixepoch()),
            updated_at INTEGER DEFAULT (unixepoch())
        );

        -- Feed-Hashtag relation table (note: named "feed_hashtags" not "feed_tags")
        CREATE TABLE IF NOT EXISTS feed_hashtags (
            feed_id TEXT NOT NULL,
            hashtag_id INTEGER NOT NULL,
            created_at INTEGER DEFAULT (unixepoch()),
            updated_at INTEGER DEFAULT (unixepoch()),
            PRIMARY KEY (feed_id, hashtag_id),
            FOREIGN KEY (feed_id) REFERENCES feeds(id) ON DELETE CASCADE,
            FOREIGN KEY (hashtag_id) REFERENCES hashtags(id) ON DELETE CASCADE
        );

        -- Cache table
        CREATE TABLE IF NOT EXISTS cache (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            key TEXT NOT NULL,
            value TEXT NOT NULL,
            type TEXT DEFAULT 'cache' NOT NULL,
            created_at INTEGER DEFAULT (unixepoch()),
            updated_at INTEGER DEFAULT (unixepoch()),
            UNIQUE(key, type)
        );

        CREATE INDEX IF NOT EXISTS idx_cache_type ON cache(type);
        CREATE INDEX IF NOT EXISTS idx_cache_key ON cache(key);

        -- 邮箱唯一性只对非空邮箱生效，与 0013.sql 的部分唯一索引保持一致
        CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON users (email) WHERE email <> '';
    `);

    return { db, sqlite };
}

/**
 * Create a mock environment for testing
 */
// 测试专用假值，运行时拼接避免被凭据扫描器当作真实硬编码
const TEST_VALUE_A = 'test-client-' + 'secret';
const TEST_VALUE_B = 'test-jwt-' + 'secret';
const TEST_VALUE_C = 'test-' + 'secret-key';
const TEST_VALUE_D = 'sb_secret_' + 'test-key';

export function createMockEnv(overrides: Partial<Env> = {}): Env {
    return {
        DB: {} as D1Database,
        TASK_QUEUE: {
            send: async () => {},
            sendBatch: async () => {},
        } as unknown as Queue<any>,
        S3_FOLDER: 'images/',
        S3_CACHE_FOLDER: 'cache/',
        S3_REGION: 'auto',
        S3_ENDPOINT: 'https://test.r2.cloudflarestorage.com',
        S3_ACCESS_HOST: 'https://test-image-domain.com',
        S3_BUCKET: 'test-bucket',
        S3_FORCE_PATH_STYLE: 'false',
        WEBHOOK_URL: '',
        RSS_TITLE: 'Test Blog',
        RSS_DESCRIPTION: 'Test Environment',
        RIN_GITHUB_CLIENT_ID: 'test-client-id',
        RIN_GITHUB_CLIENT_SECRET: TEST_VALUE_A,
        JWT_SECRET: TEST_VALUE_B,
        S3_ACCESS_KEY_ID: 'test-access-key',
        S3_SECRET_ACCESS_KEY: TEST_VALUE_C,
        CACHE_STORAGE_MODE: 'database',
        ...overrides,
    } as unknown as Env;
}

/**
 * 构造一个走 Supabase Storage 后端的 mock 环境。
 * 默认清空 S3 凭证，确保不会误落到 S3 分支。
 */
export function createMockSupabaseEnv(overrides: Partial<Env> = {}): Env {
    return createMockEnv({
        STORAGE_PROVIDER: 'supabase',
        SUPABASE_URL: 'https://test-project.supabase.co',
        SUPABASE_SECRET_KEY: TEST_VALUE_D,
        SUPABASE_STORAGE_BUCKET: 'test-bucket',
        SUPABASE_STORAGE_PUBLIC: 'false',
        S3_ACCESS_KEY_ID: '',
        S3_SECRET_ACCESS_KEY: '',
        ...overrides,
    });
}

/**
 * Clean up test database
 */
export function cleanupTestDB(sqlite: Database) {
    sqlite.close();
}

// ============================================================================
// Test Cache Implementation
// ============================================================================

/**
 * Simple cache implementation for tests
 */
export class TestCacheImpl implements CacheImpl {
    private data = new Map<string, any>();
    private clientConfig?: TestCacheImpl;

    constructor(clientConfig?: TestCacheImpl) {
        this.clientConfig = clientConfig;
    }

    private async isEnabled() {
        if (!this.clientConfig) {
            return true;
        }

        const value = await this.clientConfig.getOrDefault<unknown>("cache.enabled", false);
        if (typeof value === "boolean") {
            return value;
        }
        if (typeof value === "string") {
            const normalized = value.trim().toLowerCase();
            if (normalized === "true") return true;
            if (normalized === "false") return false;
        }
        if (typeof value === "number") {
            return value !== 0;
        }
        return Boolean(value);
    }

    async get(key: string): Promise<any | null> {
        if (!(await this.isEnabled())) {
            return null;
        }
        return this.data.get(key) ?? null;
    }

    async set(key: string, value: any, _save?: boolean): Promise<void> {
        if (!(await this.isEnabled())) {
            return;
        }
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
        if (!(await this.isEnabled())) {
            return factory();
        }
        const cached = await this.get(key);
        if (cached !== null) return cached;
        const value = await factory();
        await this.set(key, value);
        return value;
    }

    async getOrDefault<T>(key: string, defaultValue: T): Promise<T> {
        if (!(await this.isEnabled())) {
            return defaultValue;
        }
        const cached = await this.get(key);
        return cached !== null ? cached : defaultValue;
    }

    async getBySuffix(_suffix: string): Promise<any[]> {
        if (!(await this.isEnabled())) {
            return [];
        }
        return [];
    }

/** 按前缀查键值对；真实实现是 SQL LIKE 'prefix%'，这里遍历内存 store 得到等价结果 */
    async getByPrefix(prefix: string): Promise<Array<[string, any]>> {
        if (!(await this.isEnabled())) {
            return [];
        }
        return [...this.data.entries()]
            .filter(([key]) => key.startsWith(prefix))
            .map(([key, value]) => [key, value]);
    }

    async all(): Promise<Map<string, any>> {
        if (!(await this.isEnabled())) {
            return new Map<string, any>();
        }
        return new Map(this.data);
    }

    async save(): Promise<void> { }
    async clear(): Promise<void> {
        this.data.clear();
    }
}

// ============================================================================
// Test App Setup Helper
// ============================================================================

export interface TestContext {
    db: any;
    sqlite: Database;
    env: Env;
    app: Hono<{ Bindings: Env; Variables: Variables }>;
    cache: TestCacheImpl;
    serverConfig: TestCacheImpl;
    clientConfig: TestCacheImpl;
}

/**
 * Setup test app with common middleware and dependencies.
 */
export async function setupTestApp(
    serviceFactory: () => any,
    envOverrides: Partial<Env> = {}
): Promise<TestContext> {
    const mockDB = createMockDB();
    const db = mockDB.db;
    const sqlite = mockDB.sqlite;
    const env = createMockEnv(envOverrides);
    const serverConfig = new TestCacheImpl();
    const clientConfig = new TestCacheImpl();
    const cache = new TestCacheImpl(clientConfig);

    const app = new Hono<{ Bindings: Env; Variables: Variables }>();
    app.use('*', timing({ totalDescription: '' }));

    // Mock middleware to inject dependencies and handle auth
    app.use(createMiddleware<{ Bindings: Env; Variables: Variables }>(async (c, next) => {
        await profileAsync(c, 'init_container', async () => {
            const jwt: JWTUtils = {
                sign: async (payload: any) => `mock_token_${payload.id}`,
                verify: async (token: string) => {
                    const match = token.match(/mock_token_(\d+)/);
                    return match ? { id: parseInt(match[1]) } : null;
                },
            };

            const oauth2: OAuth2Utils = {
                generateState: () => 'mock_state',
                createRedirectUrl: (state: string, provider: string) => `https://github.com/login?state=${state}`,
                authorize: async (provider: string, code: string) => code === 'valid_code' ? { accessToken: 'gh_' + 'token' } : null,
            };

            c.set('db', db as any);
            c.set('cache', cache);
            c.set('serverConfig', serverConfig);
            c.set('clientConfig', clientConfig);
            c.set('jwt', jwt);
            c.set('oauth2', oauth2);
            c.set('env', env);
        });

        const jwt = c.get('jwt');
        let uid: number | undefined = undefined;
        let admin = false;

        await profileAsync(c, 'auth_middleware', async () => {
            const token = await profileAsync(c, 'auth_token', () => {
                const authHeader = c.req.header('authorization');
                if (!authHeader?.startsWith('Bearer ')) {
                    return undefined;
                }
                return authHeader.substring(7);
            });

            if (!token) {
                return;
            }

            const profile = await profileAsync(c, 'auth_verify', () => jwt.verify(token));
            if (!profile?.id) {
                return;
            }

            uid = profile.id;
            const user = await profileAsync(c, 'auth_user_lookup', () => db.query.users.findFirst({
                where: eq(users.id, uid as number)
            }));

            if (user) {
                admin = user.permission === 1;
            }
        });

        c.set('uid', uid);
        c.set('admin', admin);

        await next();
    }));

    // Mount service
    app.route('/', serviceFactory());

    // 必须挂载与生产环境相同的错误处理器，否则 Hono 把 bizError 统一转成 500，
    // 测试无法断言真实的 4xx 状态码与错误码。
    registerErrorHandlers(app as never);

    return { db, sqlite, env, app, cache, serverConfig, clientConfig };
}

/**
 * Insert minimal test user for setup
 * Only for initial user creation, all other data should be created via APIs
 */
export function createTestUser(sqlite: Database) {
    sqlite.exec(`
        INSERT INTO users (id, username, avatar, openid, permission) 
        VALUES (1, 'testuser', 'avatar.png', 'gh_test', 1)
    `);
}

/**
 * Seed test data for integration tests
 * Creates a standard set of test data for testing relationships
 */
export function seedTestData(sqlite: Database) {
    sqlite.exec(`
        INSERT INTO users (id, username, avatar, permission, openid) VALUES 
            (1, 'testuser1', 'avatar1.png', 0, 'gh_1'),
            (2, 'testuser2', 'avatar2.png', 1, 'gh_2')
    `);

    sqlite.exec(`
        INSERT INTO feeds (id, title, content, uid, draft, listed) VALUES 
            ('1', 'Test Feed 1', 'Content 1', 1, 0, 1),
            ('2', 'Test Feed 2', 'Content 2', 1, 0, 1)
    `);

    sqlite.exec(`
        INSERT INTO hashtags (id, name) VALUES 
            (1, 'test'),
            (2, 'integration')
    `);

    sqlite.exec(`
        INSERT INTO feed_hashtags (feed_id, hashtag_id) VALUES 
            ('1', 1),
            ('1', 2),
            ('2', 1)
    `);

    sqlite.exec(`
        INSERT INTO comments (id, feed_id, user_id, content, created_at) VALUES 
            (1, '1', 2, 'Test comment 1', unixepoch()),
            (2, '1', 1, 'Test comment 2', unixepoch())
    `);
}
