import { drizzle } from 'drizzle-orm/bun-sqlite';
import { Database } from 'bun:sqlite';
import * as schema from '../../src/db/schema';

/**
 * Create an in-memory test database with Drizzle ORM
 * 
 * IMPORTANT: This creates a real SQLite in-memory database that Drizzle ORM can use.
 * The key is that we create tables via raw SQL but use Drizzle for queries.
 */
export function createMockDB() {
    const sqlite = new Database(':memory:');
    
    // Initialize Drizzle with the database
    const db = drizzle(sqlite, { schema });
    
    // Create all tables using raw SQL
    // IMPORTANT: Table names must match the schema.ts definitions exactly
    sqlite.exec(`
        -- Users table
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL,
            avatar TEXT,
            openid TEXT NOT NULL,
            password TEXT,
            permission INTEGER DEFAULT 0,
            created_at INTEGER DEFAULT (unixepoch()),
            updated_at INTEGER DEFAULT (unixepoch())
        );

        -- Feeds table
        CREATE TABLE IF NOT EXISTS feeds (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            alias TEXT,
            title TEXT,
            summary TEXT DEFAULT '' NOT NULL,
            ai_summary TEXT DEFAULT '' NOT NULL,
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
            feed_id INTEGER NOT NULL,
            ip TEXT NOT NULL,
            created_at INTEGER DEFAULT (unixepoch()),
            FOREIGN KEY (feed_id) REFERENCES feeds(id) ON DELETE CASCADE
        );

        -- Visit stats table
        CREATE TABLE IF NOT EXISTS visit_stats (
            feed_id INTEGER PRIMARY KEY NOT NULL,
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
            feed_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            content TEXT NOT NULL,
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
            feed_id INTEGER NOT NULL,
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
    `);

    return { db, sqlite };
}

/**
 * Create a mock environment for testing
 */
export function createMockEnv(overrides: Partial<Env> = {}): Env {
    return {
        DB: {} as D1Database,
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
        RIN_GITHUB_CLIENT_SECRET: 'test-client-secret',
        JWT_SECRET: 'test-jwt-secret',
        S3_ACCESS_KEY_ID: 'test-access-key',
        S3_SECRET_ACCESS_KEY: 'test-secret-key',
        CACHE_STORAGE_MODE: 'database',
        ...overrides,
    } as unknown as Env;
}

/**
 * Clean up test database
 */
export function cleanupTestDB(sqlite: Database) {
    sqlite.close();
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
    // Insert test users
    sqlite.exec(`
        INSERT INTO users (id, username, avatar, permission, openid) VALUES 
            (1, 'testuser1', 'avatar1.png', 0, 'gh_1'),
            (2, 'testuser2', 'avatar2.png', 1, 'gh_2')
    `);

    // Insert test feeds
    sqlite.exec(`
        INSERT INTO feeds (id, title, content, uid, draft, listed) VALUES 
            (1, 'Test Feed 1', 'Content 1', 1, 0, 1),
            (2, 'Test Feed 2', 'Content 2', 1, 0, 1)
    `);

    // Insert test tags
    sqlite.exec(`
        INSERT INTO hashtags (id, name) VALUES 
            (1, 'test'),
            (2, 'integration')
    `);

    // Insert feed-tag relationships
    sqlite.exec(`
        INSERT INTO feed_hashtags (feed_id, hashtag_id) VALUES 
            (1, 1),
            (1, 2),
            (2, 1)
    `);

    // Insert test comments
    sqlite.exec(`
        INSERT INTO comments (id, feed_id, user_id, content, created_at) VALUES 
            (1, 1, 2, 'Test comment 1', unixepoch()),
            (2, 1, 1, 'Test comment 2', unixepoch())
    `);
}
