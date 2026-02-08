import { eq, and, like } from "drizzle-orm";
import type { DB } from "../server";
import { cache } from "../db/schema";
import { path_join } from "./path";

// Cache Utils for storing data in memory and persisting to database (with optional S3 backup)

export type CacheStorageMode = 'database' | 's3';

// 存储提供者接口
interface StorageProvider {
    load(): Promise<void>;
    save(): Promise<void>;
    delete(key: string): Promise<void>;
    clear(): Promise<void>;
}

// 数据库存储提供者
class DatabaseStorageProvider implements StorageProvider {
    constructor(private db: DB, private cacheMap: Map<string, any>, private type: string) {}

    async load(): Promise<void> {
        console.log('Cache load from database', this.type);
        try {
            const rows = await this.db.select().from(cache).where(eq(cache.type, this.type));
            for (const row of rows) {
                try {
                    this.cacheMap.set(row.key, JSON.parse(row.value));
                } catch (e) {
                    this.cacheMap.set(row.key, row.value);
                }
            }
            console.log(`Cache loaded ${rows.length} entries from database`);
        } catch (e: any) {
            console.error('Cache load from database failed');
            console.error(e.message);
        }
    }

    async save(): Promise<void> {
        // Get all existing keys from database for this cache type
        const existingRows = await this.db.select({ key: cache.key }).from(cache).where(eq(cache.type, this.type));
        const existingKeys = new Set(existingRows.map(row => row.key));
        const currentKeys = new Set(this.cacheMap.keys());

        // Delete keys from database that are no longer in memory
        for (const key of existingKeys) {
            if (!currentKeys.has(key)) {
                await this.db.delete(cache)
                    .where(and(eq(cache.key, key), eq(cache.type, this.type)));
                console.log('Cache removed from database:', key);
            }
        }

        // Save or update current cache entries
        for (const [key, value] of this.cacheMap.entries()) {
            if (value === undefined) {
                console.warn(`Cache: Skipping undefined value for key "${key}"`);
                continue;
            }

            const valueStr = typeof value === 'string' ? value : JSON.stringify(value);

            if (existingKeys.has(key)) {
                await this.db.update(cache)
                    .set({ value: valueStr, updatedAt: new Date() })
                    .where(and(eq(cache.key, key), eq(cache.type, this.type)));
            } else {
                await this.db.insert(cache).values({
                    key,
                    value: valueStr,
                    type: this.type,
                });
            }
        }
    }

    async delete(key: string): Promise<void> {
        try {
            await this.db.delete(cache)
                .where(and(eq(cache.key, key), eq(cache.type, this.type)));
            console.log('Cache deleted from database:', key);
        } catch (e: any) {
            console.error('Cache delete from database failed');
            console.error(e.message);
        }
    }

    async clear(): Promise<void> {
        try {
            await this.db.delete(cache).where(eq(cache.type, this.type));
            console.log('Cache cleared from database');
        } catch (e: any) {
            console.error('Cache clear from database failed');
            console.error(e.message);
        }
    }
}

// S3 存储提供者
class S3StorageProvider implements StorageProvider {
    private s3Instance: any = null;
    private cacheUrl: string;

    constructor(private env: Env, private cacheMap: Map<string, any>, private type: string) {
        const slash = this.env.S3_ACCESS_HOST.endsWith('/') ? '' : '/';
        this.cacheUrl = this.env.S3_ACCESS_HOST + slash + path_join(this.env.S3_CACHE_FOLDER || 'cache', `${type}.json`);
    }

    private async getS3() {
        if (!this.s3Instance) {
            const { createS3Client } = await import('./s3');
            this.s3Instance = createS3Client(this.env);
        }
        return this.s3Instance;
    }

    async load(): Promise<void> {
        console.log('Cache load from S3', this.cacheUrl);
        try {
            const response = await fetch(new Request(this.cacheUrl));
            const data = await response.json<any>();
            for (let key in data) {
                this.cacheMap.set(key, data[key]);
            }
        } catch (e: any) {
            console.error('Cache load from S3 failed');
            console.error(e.message);
        }
    }

    async save(): Promise<void> {
        try {
            const { putObject } = await import('./s3');
            const s3 = await this.getS3();
            const cacheKey = path_join(this.env.S3_CACHE_FOLDER, `${this.type}.json`);
            await putObject(
                s3,
                this.env,
                cacheKey,
                JSON.stringify(Object.fromEntries(this.cacheMap)),
                'application/json'
            ).then(() => {
                console.log('Cache saved to S3');
            }).catch((e: any) => {
                console.error('Cache save to S3 failed');
                console.error(e.message);
            });
        } catch (e: any) {
            console.error('Cache save to S3 failed');
            console.error(e.message);
        }
    }

    async delete(): Promise<void> {
        await this.save();
    }

    async clear(): Promise<void> {
        await this.save();
    }
}

export class CacheImpl {
    cache: Map<string, any> = new Map<string, any>();
    db: DB;
    env: Env;
    type: string;
    loaded: boolean = false;
    private storageProvider: StorageProvider;

    constructor(db: DB, env: Env, type: string = "cache", storageMode?: CacheStorageMode) {
        this.type = type;
        this.db = db;
        this.env = env;
        this.cache = new Map<string, any>();

        // 优先级：参数 > 环境变量，默认为 s3 以向前兼容
        const mode = storageMode ?? (env.CACHE_STORAGE_MODE as CacheStorageMode) ?? 's3';

        // 根据存储模式创建对应的提供者
        if (mode === 's3') {
            this.storageProvider = new S3StorageProvider(env, this.cache, type);
        } else {
            this.storageProvider = new DatabaseStorageProvider(db, this.cache, type);
        }
    }

    async load() {
        await this.storageProvider.load();
        this.loaded = true;
    }

    async all() {
        if (!this.loaded) {
            await this.load();
        }
        return this.cache;
    }

    async get(key: string) {
        if (!this.loaded) {
            await this.load();
        }
        return this.cache.get(key);
    }

    async getByPrefix(prefix: string): Promise<any[]> {
        if (!this.loaded) {
            await this.load();
        }
        const result = [];
        for (let key of this.cache.keys()) {
            if (key.startsWith(prefix)) {
                result.push(this.cache.get(key));
            }
        }
        return result;
    }

    async getBySuffix(suffix: string): Promise<any[]> {
        if (!this.loaded) {
            await this.load();
        }
        const result = [];
        for (let key of this.cache.keys()) {
            if (key.endsWith(suffix)) {
                result.push(this.cache.get(key));
            }
        }
        return result;
    }

    async getOrSet<T>(key: string, value: () => Promise<T>) {
        const cached = await this.get(key);
        if (cached !== undefined) {
            console.log('Cache hit', key);
            return cached as T;
        }
        console.log('Cache miss', key);
        const newValue = await value();
        await this.set(key, newValue);
        return newValue;
    }

    async getOrDefault<T>(key: string, defaultValue: T) {
        return this.getOrSet(key, async () => defaultValue);
    }

    async set(key: string, value: any, save: boolean = true) {
        if (!this.loaded)
            await this.load();
        this.cache.set(key, value);
        if (save) {
            await this.save();
        }
    }

    async delete(key: string, save: boolean = true) {
        if (!this.loaded)
            await this.load();
        this.cache.delete(key);
        if (save) {
            await this.storageProvider.delete(key);
        }
    }

    async deletePrefix(prefix: string) {
        for (let key of this.cache.keys()) {
            console.log('Cache key', key);
            if (key.startsWith(prefix)) {
                console.log('Cache delete', key);
                await this.delete(key, false);
            }
        }
        await this.save();
    }

    async deleteSuffix(suffix: string) {
        for (let key of this.cache.keys()) {
            console.log("Cache key", key);
            if (key.endsWith(suffix)) {
                console.log("Cache delete", key);
                await this.delete(key, false);
            }
        }
        await this.save();
    }

    async clear() {
        this.cache.clear();
        await this.storageProvider.clear();
    }

    async save() {
        await this.storageProvider.save();
    }

    // Migration helper: Load from S3 and save to database
    async migrateFromS3ToDatabase() {
        console.log('Migrating cache from S3 to database...');
        const s3Provider = new S3StorageProvider(this.env, this.cache, this.type);
        await s3Provider.load();
        const dbProvider = new DatabaseStorageProvider(this.db, this.cache, this.type);
        await dbProvider.save();
        console.log('Migration completed');
    }
}

// Factory functions to create cache instances with context
export function createPublicCache(db: DB, env: Env, storageMode?: CacheStorageMode) {
    return new CacheImpl(db, env, "cache", storageMode);
}

export function createServerConfig(db: DB, env: Env, storageMode?: CacheStorageMode) {
    return new CacheImpl(db, env, "server.config", storageMode);
}

export function createClientConfig(db: DB, env: Env, storageMode?: CacheStorageMode) {
    return new CacheImpl(db, env, "client.config", storageMode);
}
