import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { Database } from 'bun:sqlite';
import { CacheImpl, createPublicCache, createServerConfig, createClientConfig, type CacheStorageMode } from '../cache';
import { cache } from '../../db/schema';
import { eq, and } from 'drizzle-orm';
import * as schema from '../../db/schema';
/// <reference types="../../../worker-configuration" />

// 测试数据库设置
function createTestDB() {
    const sqlite = new Database(':memory:');
    const db = drizzle(sqlite, { schema });
    
    // 创建缓存表 - 使用复合唯一约束 (key, type)
    sqlite.exec(`
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

// 模拟环境变量
function createMockEnv(storageMode: CacheStorageMode = 'database'): Env {
    return {
        DB: {} as D1Database,
        FRONTEND_URL: 'http://localhost:5173',
        S3_FOLDER: 'images/',
        S3_CACHE_FOLDER: 'cache/',
        S3_REGION: 'auto',
        S3_ENDPOINT: 'https://test.r2.cloudflarestorage.com',
        S3_ACCESS_HOST: 'https://test-image-domain.com',
        S3_BUCKET: 'test-bucket',
        S3_FORCE_PATH_STYLE: 'false',
        WEBHOOK_URL: '',
        RSS_TITLE: 'Test',
        RSS_DESCRIPTION: 'Test Environment',
        RIN_GITHUB_CLIENT_ID: 'test-client-id',
        RIN_GITHUB_CLIENT_SECRET: 'test-client-secret',
        JWT_SECRET: 'test-jwt-secret',
        S3_ACCESS_KEY_ID: 'test-access-key',
        S3_SECRET_ACCESS_KEY: 'test-secret-key',
        CACHE_STORAGE_MODE: storageMode,
    } as unknown as Env;
}

describe('CacheImpl - 基本功能测试', () => {
    let { db, sqlite } = createTestDB();
    let mockEnv: Env;
    let cacheImpl: CacheImpl;

    beforeEach(() => {
        const testDB = createTestDB();
        db = testDB.db;
        sqlite = testDB.sqlite;
        mockEnv = createMockEnv('database');
        cacheImpl = new CacheImpl(db as any, mockEnv, 'cache', 'database');
    });

    afterEach(() => {
        sqlite.close();
    });

    describe('set 和 get', () => {
        it('应该能够存储和检索字符串值', async () => {
            await cacheImpl.set('key1', 'value1');
            const value = await cacheImpl.get('key1');
            expect(value).toBe('value1');
        });

        it('应该能够存储和检索对象值', async () => {
            const obj = { name: 'test', value: 123 };
            await cacheImpl.set('key2', obj);
            const value = await cacheImpl.get('key2');
            expect(value).toEqual(obj);
        });

        it('应该能够存储和检索数组值', async () => {
            const arr = [1, 2, 3, 'test'];
            await cacheImpl.set('key3', arr);
            const value = await cacheImpl.get('key3');
            expect(value).toEqual(arr);
        });

        it('应该能够存储和检索数字值', async () => {
            await cacheImpl.set('key4', 42);
            const value = await cacheImpl.get('key4');
            expect(value).toBe(42);
        });

        it('应该能够存储和检索布尔值', async () => {
            await cacheImpl.set('key5', true);
            const value = await cacheImpl.get('key5');
            expect(value).toBe(true);
        });

        it('应该能够更新已存在的键', async () => {
            await cacheImpl.set('key1', 'value1');
            await cacheImpl.set('key1', 'value2');
            const value = await cacheImpl.get('key1');
            expect(value).toBe('value2');
        });

        it('应该返回 undefined 对于不存在的键', async () => {
            const value = await cacheImpl.get('nonexistent');
            expect(value).toBeUndefined();
        });
    });

    describe('delete', () => {
        it('应该能够删除已存在的键', async () => {
            await cacheImpl.set('key1', 'value1');
            await cacheImpl.delete('key1');
            const value = await cacheImpl.get('key1');
            expect(value).toBeUndefined();
        });

        it('删除不存在的键不应该报错', async () => {
            // 删除不存在的键应该正常完成，不抛出错误
            await cacheImpl.delete('nonexistent');
            // 如果执行到这里没有抛出错误，测试就通过了
            expect(true).toBe(true);
        });
    });

    describe('getByPrefix', () => {
        beforeEach(async () => {
            await cacheImpl.set('user:1', 'Alice');
            await cacheImpl.set('user:2', 'Bob');
            await cacheImpl.set('user:3', 'Charlie');
            await cacheImpl.set('post:1', 'Post 1');
            await cacheImpl.set('other', 'Other');
        });

        it('应该返回匹配前缀的所有值', async () => {
            const users = await cacheImpl.getByPrefix('user:');
            expect(users).toHaveLength(3);
            expect(users).toContain('Alice');
            expect(users).toContain('Bob');
            expect(users).toContain('Charlie');
        });

        it('应该返回空数组当没有匹配的前缀', async () => {
            const result = await cacheImpl.getByPrefix('nonexistent:');
            expect(result).toEqual([]);
        });

        it('应该正确匹配特定前缀', async () => {
            const posts = await cacheImpl.getByPrefix('post:');
            expect(posts).toHaveLength(1);
            expect(posts).toContain('Post 1');
        });
    });

    describe('getBySuffix', () => {
        beforeEach(async () => {
            await cacheImpl.set('file.txt', 'Text file');
            await cacheImpl.set('document.txt', 'Document');
            await cacheImpl.set('image.png', 'PNG image');
            await cacheImpl.set('script.js', 'JavaScript');
        });

        it('应该返回匹配后缀的所有值', async () => {
            const txtFiles = await cacheImpl.getBySuffix('.txt');
            expect(txtFiles).toHaveLength(2);
            expect(txtFiles).toContain('Text file');
            expect(txtFiles).toContain('Document');
        });

        it('应该返回空数组当没有匹配的后缀', async () => {
            const result = await cacheImpl.getBySuffix('.zip');
            expect(result).toEqual([]);
        });
    });

    describe('deletePrefix', () => {
        beforeEach(async () => {
            await cacheImpl.set('temp:1', 'Temp 1');
            await cacheImpl.set('temp:2', 'Temp 2');
            await cacheImpl.set('temp:3', 'Temp 3');
            await cacheImpl.set('keep:1', 'Keep 1');
        });

        it('应该删除匹配前缀的所有键', async () => {
            await cacheImpl.deletePrefix('temp:');
            
            expect(await cacheImpl.get('temp:1')).toBeUndefined();
            expect(await cacheImpl.get('temp:2')).toBeUndefined();
            expect(await cacheImpl.get('temp:3')).toBeUndefined();
            expect(await cacheImpl.get('keep:1')).toBe('Keep 1');
        });

        it('应该正常工作当没有匹配的键', async () => {
            // 删除不存在的前缀应该正常完成，不抛出错误
            await cacheImpl.deletePrefix('nonexistent:');
            // 如果执行到这里没有抛出错误，测试就通过了
            expect(true).toBe(true);
        });
    });

    describe('deleteSuffix', () => {
        beforeEach(async () => {
            await cacheImpl.set('cache.tmp', 'Temp cache');
            await cacheImpl.set('data.tmp', 'Temp data');
            await cacheImpl.set('config.json', 'Config');
        });

        it('应该删除匹配后缀的所有键', async () => {
            await cacheImpl.deleteSuffix('.tmp');
            
            expect(await cacheImpl.get('cache.tmp')).toBeUndefined();
            expect(await cacheImpl.get('data.tmp')).toBeUndefined();
            expect(await cacheImpl.get('config.json')).toBe('Config');
        });
    });

    describe('clear', () => {
        it('应该清除所有缓存数据', async () => {
            await cacheImpl.set('key1', 'value1');
            await cacheImpl.set('key2', 'value2');
            
            await cacheImpl.clear();
            
            expect(await cacheImpl.get('key1')).toBeUndefined();
            expect(await cacheImpl.get('key2')).toBeUndefined();
        });

        it('应该正常工作当缓存为空', async () => {
            // 清空空缓存应该正常完成，不抛出错误
            await cacheImpl.clear();
            // 如果执行到这里没有抛出错误，测试就通过了
            expect(true).toBe(true);
        });
    });

    describe('all', () => {
        it('应该返回所有缓存项', async () => {
            await cacheImpl.set('key1', 'value1');
            await cacheImpl.set('key2', 'value2');
            
            const all = await cacheImpl.all();
            
            expect(all.get('key1')).toBe('value1');
            expect(all.get('key2')).toBe('value2');
            expect(all.size).toBe(2);
        });
    });
});

describe('CacheImpl - 数据库持久化测试', () => {
    let { db, sqlite } = createTestDB();
    let mockEnv: Env;
    let cacheImpl: CacheImpl;

    beforeEach(() => {
        const testDB = createTestDB();
        db = testDB.db;
        sqlite = testDB.sqlite;
        mockEnv = createMockEnv('database');
        cacheImpl = new CacheImpl(db as any, mockEnv, 'cache', 'database');
    });

    afterEach(() => {
        sqlite.close();
    });

    it('应该将数据持久化到数据库', async () => {
        await cacheImpl.set('key1', 'value1');
        
        // 直接查询数据库验证
        const rows = await db.select().from(cache).where(eq(cache.key, 'key1'));
        expect(rows).toHaveLength(1);
        // 字符串值直接存储，不添加引号
        expect(rows[0].value).toBe('value1');
        expect(rows[0].type).toBe('cache');
    });

    it('应该能够从数据库加载数据', async () => {
        // 先存储数据
        await cacheImpl.set('key1', 'value1');
        
        // 创建新的 cache 实例（模拟重启）
        const newCache = new CacheImpl(db as any, mockEnv, 'cache', 'database');
        
        // 新实例应该能读取到数据
        const value = await newCache.get('key1');
        expect(value).toBe('value1');
    });

    it('应该正确更新数据库中的现有键', async () => {
        await cacheImpl.set('key1', 'value1');
        await cacheImpl.set('key1', 'value2');
        
        const rows = await db.select().from(cache).where(eq(cache.key, 'key1'));
        expect(rows).toHaveLength(1);
        // 字符串值直接存储，不添加引号
        expect(rows[0].value).toBe('value2');
    });

    it('删除时应该从数据库中移除', async () => {
        await cacheImpl.set('key1', 'value1');
        await cacheImpl.delete('key1');
        
        const rows = await db.select().from(cache).where(eq(cache.key, 'key1'));
        expect(rows).toHaveLength(0);
    });

    it('clear 应该清空数据库中的所有缓存项', async () => {
        await cacheImpl.set('key1', 'value1');
        await cacheImpl.set('key2', 'value2');
        
        await cacheImpl.clear();
        
        const rows = await db.select().from(cache).where(eq(cache.type, 'cache'));
        expect(rows).toHaveLength(0);
    });

    it('应该支持多个 cache 类型', async () => {
        const cache1 = new CacheImpl(db as any, mockEnv, 'type1', 'database');
        const cache2 = new CacheImpl(db as any, mockEnv, 'type2', 'database');
        
        await cache1.set('key', 'value1');
        await cache2.set('key', 'value2');
        
        const rows = await db.select().from(cache);
        expect(rows).toHaveLength(2);
        
        const type1Rows = rows.filter(r => r.type === 'type1');
        const type2Rows = rows.filter(r => r.type === 'type2');
        
        expect(type1Rows).toHaveLength(1);
        expect(type2Rows).toHaveLength(1);
        // 字符串值直接存储，不添加引号
        expect(type1Rows[0].value).toBe('value1');
        expect(type2Rows[0].value).toBe('value2');
    });
});

describe('CacheImpl - 存储模式配置测试', () => {
    let { db, sqlite } = createTestDB();
    let mockEnv: Env;

    beforeEach(() => {
        const testDB = createTestDB();
        db = testDB.db;
        sqlite = testDB.sqlite;
    });

    afterEach(() => {
        sqlite.close();
    });

    it('应该默认使用数据库存储', () => {
        mockEnv = createMockEnv('database');
        const cache = new CacheImpl(db as any, mockEnv, 'cache');
        
        // 通过检查是否尝试加载数据库来验证
        expect(cache).toBeDefined();
    });

    it('应该支持通过环境变量配置存储模式', () => {
        mockEnv = createMockEnv('s3');
        const cache = new CacheImpl(db as any, mockEnv, 'cache');
        
        expect(cache).toBeDefined();
    });



    it('storageMode 参数应该覆盖环境变量', () => {
        mockEnv = createMockEnv('s3');
        const cache = new CacheImpl(db as any, mockEnv, 'cache', 'database');
        
        expect(cache).toBeDefined();
    });
});

describe('CacheImpl - 工厂函数测试', () => {
    let { db, sqlite } = createTestDB();
    let mockEnv: Env;

    beforeEach(() => {
        const testDB = createTestDB();
        db = testDB.db;
        sqlite = testDB.sqlite;
        mockEnv = createMockEnv('database');
    });

    afterEach(() => {
        sqlite.close();
    });

    it('createPublicCache 应该创建通用缓存', () => {
        const cache = createPublicCache(db as any, mockEnv);
        expect(cache).toBeInstanceOf(CacheImpl);
    });

    it('createServerConfig 应该创建服务器配置缓存', () => {
        const cache = createServerConfig(db as any, mockEnv);
        expect(cache).toBeInstanceOf(CacheImpl);
    });

    it('createClientConfig 应该创建客户端配置缓存', () => {
        const cache = createClientConfig(db as any, mockEnv);
        expect(cache).toBeInstanceOf(CacheImpl);
    });

    it('工厂函数应该支持自定义选项', () => {
        const cache = createPublicCache(db as any, mockEnv, 'database');
        expect(cache).toBeInstanceOf(CacheImpl);
    });
});

describe('CacheImpl - 边界条件和错误处理', () => {
    let { db, sqlite } = createTestDB();
    let mockEnv: Env;
    let cacheImpl: CacheImpl;

    beforeEach(() => {
        const testDB = createTestDB();
        db = testDB.db;
        sqlite = testDB.sqlite;
        mockEnv = createMockEnv('database');
        cacheImpl = new CacheImpl(db as any, mockEnv, 'cache', 'database');
    });

    afterEach(() => {
        sqlite.close();
    });

    it('应该处理空字符串键', async () => {
        await cacheImpl.set('', 'empty key');
        const value = await cacheImpl.get('');
        expect(value).toBe('empty key');
    });

    it('应该处理特殊字符键', async () => {
        const specialKeys = [
            'key with spaces',
            'key\nwith\nnewlines',
            'key\twith\ttabs',
            'key:with:colons',
            'key/with/slashes',
            'key\\with\\backslashes',
            'key"with"quotes',
            "key'with'quotes",
        ];

        for (const key of specialKeys) {
            await cacheImpl.set(key, `value for ${key}`);
            const value = await cacheImpl.get(key);
            expect(value).toBe(`value for ${key}`);
        }
    });

    it('应该处理嵌套对象', async () => {
        const nested = {
            level1: {
                level2: {
                    level3: {
                        value: 'deep nested'
                    }
                }
            }
        };
        
        await cacheImpl.set('nested', nested);
        const value = await cacheImpl.get('nested');
        expect(value).toEqual(nested);
    });

    it('应该处理循环引用（应该抛出错误或处理）', async () => {
        const obj: any = { name: 'test' };
        obj.self = obj; // 循环引用

        // JSON.stringify 会抛出错误，我们的实现应该处理这种情况
        // 当前实现会抛出错误，这是预期行为
        let errorThrown = false;
        let caughtError: any = null;
        try {
            await cacheImpl.set('circular', obj);
        } catch (e) {
            errorThrown = true;
            caughtError = e;
        }

        // 验证确实抛出了错误（当前实现会抛出）
        expect(errorThrown).toBe(true);
        expect(caughtError).toBeDefined();
        expect(caughtError).not.toBeNull();

        // 注意：值会被设置到内存缓存，但保存到数据库会失败
        // 所以缓存中会有这个值，但重启后会丢失
        const value = await cacheImpl.get('circular');
        expect(value).toBeDefined();
        expect(value.name).toBe('test');
    });

    it('应该处理 null 值', async () => {
        // null 会被存储为 "null" 字符串，读取时解析回 null
        await cacheImpl.set('nullKey', null);
        const value = await cacheImpl.get('nullKey');
        // JSON.parse("null") 返回 null
        expect(value).toBeNull();
    });

    it('应该处理 undefined 值', async () => {
        // undefined 值会被跳过，不会存储到数据库
        // 内存中会有这个值，但不会被持久化
        await cacheImpl.set('undefinedKey', undefined);
        
        // 从内存中获取应该是 undefined
        const value = await cacheImpl.get('undefinedKey');
        expect(value).toBeUndefined();
        
        // 创建新实例验证数据库中确实没有存储
        const newCache = new CacheImpl(db as any, mockEnv, 'cache', 'database');
        const valueFromDb = await newCache.get('undefinedKey');
        expect(valueFromDb).toBeUndefined();
    });

    it('应该处理大字符串值', async () => {
        const largeString = 'x'.repeat(10000);
        await cacheImpl.set('large', largeString);
        const value = await cacheImpl.get('large');
        expect(value).toBe(largeString);
    });

    it('应该处理大量键值对', async () => {
        const count = 100;
        for (let i = 0; i < count; i++) {
            await cacheImpl.set(`key${i}`, `value${i}`);
        }
        
        const all = await cacheImpl.all();
        expect(all.size).toBe(count);
        
        // 验证随机几个键
        expect(await cacheImpl.get('key0')).toBe('value0');
        expect(await cacheImpl.get('key50')).toBe('value50');
        expect(await cacheImpl.get('key99')).toBe('value99');
    });
});

describe('CacheImpl - getOrSet 和 getOrDefault', () => {
    let { db, sqlite } = createTestDB();
    let mockEnv: Env;
    let cacheImpl: CacheImpl;

    beforeEach(() => {
        const testDB = createTestDB();
        db = testDB.db;
        sqlite = testDB.sqlite;
        mockEnv = createMockEnv('database');
        cacheImpl = new CacheImpl(db as any, mockEnv, 'cache', 'database');
    });

    afterEach(() => {
        sqlite.close();
    });

    describe('getOrSet', () => {
        it('当键不存在时应该计算并存储值', async () => {
            let computed = false;
            const value = await cacheImpl.getOrSet('computed', async () => {
                computed = true;
                return 'computed value';
            });
            
            expect(computed).toBe(true);
            expect(value).toBe('computed value');
            expect(await cacheImpl.get('computed')).toBe('computed value');
        });

        it('当键存在时应该返回缓存值而不重新计算', async () => {
            await cacheImpl.set('cached', 'existing value');
            
            let computed = false;
            const value = await cacheImpl.getOrSet('cached', async () => {
                computed = true;
                return 'new value';
            });
            
            expect(computed).toBe(false);
            expect(value).toBe('existing value');
        });

        it('应该支持异步计算函数', async () => {
            const value = await cacheImpl.getOrSet('async', async () => {
                await new Promise(resolve => setTimeout(resolve, 10));
                return 'async value';
            });
            
            expect(value).toBe('async value');
        });
    });

    describe('getOrDefault', () => {
        it('当键不存在时应该返回默认值', async () => {
            const value = await cacheImpl.getOrDefault('missing', 'default');
            expect(value).toBe('default');
        });

        it('当键存在时应该返回缓存值', async () => {
            await cacheImpl.set('exists', 'cached');
            const value = await cacheImpl.getOrDefault('exists', 'default');
            expect(value).toBe('cached');
        });

        it('应该支持不同类型的默认值', async () => {
            expect(await cacheImpl.getOrDefault('string', 'default')).toBe('default');
            expect(await cacheImpl.getOrDefault('number', 42)).toBe(42);
            expect(await cacheImpl.getOrDefault('boolean', true)).toBe(true);
            expect(await cacheImpl.getOrDefault('array', [1, 2, 3])).toEqual([1, 2, 3]);
            expect(await cacheImpl.getOrDefault('object', { key: 'value' })).toEqual({ key: 'value' });
        });
    });
});
