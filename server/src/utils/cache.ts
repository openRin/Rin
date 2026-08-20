import { eq, and, like } from "drizzle-orm";
import type { DB } from "../core/hono-types";
import { cache } from "../db/schema";
import { path_join } from "./path";
import { getStorageObject, putStorageObjectAtKey } from "./storage";

// Cache Utils for storing data in memory and persisting to database (with optional S3 backup)

export type CacheStorageMode = 'database' | 's3';

type CacheConfigReader = {
    getOrDefault<T>(key: string, defaultValue: T): Promise<T>;
};

function normalizeCacheEnabled(value: unknown) {
    if (typeof value === "boolean") {
        return value;
    }

    if (typeof value === "string") {
        const normalized = value.trim().toLowerCase();
        if (normalized === "true") {
            return true;
        }
        if (normalized === "false") {
            return false;
        }
    }

    if (typeof value === "number") {
        return value !== 0;
    }

    return Boolean(value);
}

export async function isPublicCacheEnabled(clientConfig: CacheConfigReader) {
    const value = await clientConfig.getOrDefault("cache.enabled", false);
    return normalizeCacheEnabled(value);
}

// 存储提供者接口
interface StorageProvider {
    readonly supportsPartialAccess: boolean;
    load(): Promise<void>;
    save(): Promise<void>;
    get?(key: string): Promise<{ found: boolean; value?: any }>;
    getByPrefix?(prefix: string): Promise<Array<[string, any]>>;
    getBySuffix?(suffix: string): Promise<Array<[string, any]>>;
    set?(key: string, value: any): Promise<void>;
    delete(key: string): Promise<void>;
    deletePrefix?(prefix: string): Promise<void>;
    deleteSuffix?(suffix: string): Promise<void>;
    clear(): Promise<void>;
}

function deserializeCacheValue(value: string) {
    try {
        return JSON.parse(value);
    } catch {
        return value;
    }
}

function serializeCacheValue(value: any) {
    return typeof value === 'string' ? value : JSON.stringify(value);
}

// 数据库存储提供者
class DatabaseStorageProvider implements StorageProvider {
    readonly supportsPartialAccess = true;

    constructor(private db: DB, private cacheMap: Map<string, any>, private type: string) {}

    async load(): Promise<void> {
        console.log('Cache load from database', this.type);
        try {
            const rows = await this.db.select().from(cache).where(eq(cache.type, this.type));
            for (const row of rows) {
                this.cacheMap.set(row.key, deserializeCacheValue(row.value));
            }
            console.log(`Cache loaded ${rows.length} entries from database`);
        } catch (e: any) {
            console.error('Cache load from database failed');
            console.error(e.message);
        }
    }

    async save(): Promise<void> {
        for (const [key, value] of this.cacheMap.entries()) {
            await this.set(key, value);
        }
    }

    async get(key: string): Promise<{ found: boolean; value?: any }> {
        const rows = await this.db.select({ value: cache.value })
            .from(cache)
            .where(and(eq(cache.key, key), eq(cache.type, this.type)))
            .limit(1);
        if (rows.length === 0) {
            return { found: false };
        }

        return { found: true, value: deserializeCacheValue(rows[0].value) };
    }

    private async getMatching(pattern: string): Promise<Array<[string, any]>> {
        const rows = await this.db.select({ key: cache.key, value: cache.value })
            .from(cache)
            .where(and(eq(cache.type, this.type), like(cache.key, pattern)));
        return rows.map((row) => [row.key, deserializeCacheValue(row.value)]);
    }

    async getByPrefix(prefix: string) {
        return this.getMatching(`${prefix}%`);
    }

    async getBySuffix(suffix: string) {
        return this.getMatching(`%${suffix}`);
    }

    async set(key: string, value: any): Promise<void> {
        if (value === undefined) {
            console.warn(`Cache: Skipping undefined value for key "${key}"`);
            return;
        }

        await this.db.insert(cache).values({
            key,
            value: serializeCacheValue(value),
            type: this.type,
            updatedAt: new Date(),
        }).onConflictDoUpdate({
            target: [cache.key, cache.type],
            set: {
                value: serializeCacheValue(value),
                updatedAt: new Date(),
            },
        });
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

    async deletePrefix(prefix: string): Promise<void> {
        await this.db.delete(cache)
            .where(and(eq(cache.type, this.type), like(cache.key, `${prefix}%`)));
    }

    async deleteSuffix(suffix: string): Promise<void> {
        await this.db.delete(cache)
            .where(and(eq(cache.type, this.type), like(cache.key, `%${suffix}`)));
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
    readonly supportsPartialAccess = false;
    private cacheKey: string;

    constructor(private env: Env, private cacheMap: Map<string, any>, private type: string) {
        this.cacheKey = path_join(this.env.S3_CACHE_FOLDER || 'cache', `${type}.json`);
    }

    async load(): Promise<void> {
        console.log('Cache load from storage', this.cacheKey);
        try {
            const response = await getStorageObject(this.env, this.cacheKey);
            if (!response) {
                console.log('Cache file not found in storage, starting with empty cache');
                return;
            }
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
            await putStorageObjectAtKey(
                this.env,
                this.cacheKey,
                JSON.stringify(Object.fromEntries(this.cacheMap)),
                'application/json'
            ).then(() => {
                console.log('Cache saved to storage');
            }).catch((e: any) => {
                console.error('Cache save to storage failed');
                console.error(e.message);
            });
        } catch (e: any) {
            console.error('Cache save to storage failed');
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
    private cacheEnabled: Promise<boolean> | null = null;
    private configReader?: CacheConfigReader;
    private dirtyKeys = new Set<string>();
    private pendingDeletes = new Set<string>();

    constructor(
        db: DB,
        env: Env,
        type: string = "cache",
        storageMode?: CacheStorageMode,
        configReader?: CacheConfigReader,
    ) {
        // 确保 type 不为空，防止不同类型共享同一个存储位置
        if (!type || type.trim() === '') {
            throw new Error('Cache type cannot be empty');
        }
        this.type = type;
        this.db = db;
        this.env = env;
        this.cache = new Map<string, any>();
        this.configReader = configReader;

        // 优先级：参数 > 环境变量，默认为 s3 以向前兼容
        const mode = storageMode ?? (env.CACHE_STORAGE_MODE as CacheStorageMode) ?? 's3';

        // 根据存储模式创建对应的提供者
        if (mode === 's3') {
            this.storageProvider = new S3StorageProvider(env, this.cache, type);
        } else {
            this.storageProvider = new DatabaseStorageProvider(db, this.cache, type);
        }
    }

    private async isEnabled() {
        // Only the public content cache is gated by `cache.enabled`.
        // Config stores must stay readable, otherwise `cache -> client.config`
        // would recurse back into the same gate and break initialization.
        if (this.type !== "cache") {
            return true;
        }

        if (!this.configReader) {
            return true;
        }

        if (!this.cacheEnabled) {
            this.cacheEnabled = isPublicCacheEnabled(this.configReader);
        }

        return this.cacheEnabled;
    }

    async load() {
        await this.storageProvider.load();
        this.loaded = true;
    }

    async all() {
        if (!(await this.isEnabled())) {
            return new Map<string, any>();
        }
        if (!this.loaded) {
            if (this.storageProvider.supportsPartialAccess) {
                await this.save();
            }
            await this.load();
        }
        return this.cache;
    }

    async get(key: string) {
        if (!(await this.isEnabled())) {
            return null;
        }
        if (this.cache.has(key)) {
            return this.cache.get(key);
        }
        if (this.pendingDeletes.has(key)) {
            return undefined;
        }
        if (this.storageProvider.supportsPartialAccess && this.storageProvider.get) {
            const stored = await this.storageProvider.get(key);
            if (stored.found) {
                this.cache.set(key, stored.value);
                return stored.value;
            }
            return undefined;
        }
        if (!this.loaded) {
            await this.load();
        }
        return this.cache.get(key);
    }

    async getByPrefix(prefix: string): Promise<any[]> {
        if (!(await this.isEnabled())) {
            return [];
        }
        if (this.storageProvider.supportsPartialAccess && this.storageProvider.getByPrefix) {
            await this.save();
            const entries = await this.storageProvider.getByPrefix(prefix);
            for (const [key, value] of entries) {
                this.cache.set(key, value);
            }
            return entries.map(([, value]) => value);
        }
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
        if (!(await this.isEnabled())) {
            return [];
        }
        if (this.storageProvider.supportsPartialAccess && this.storageProvider.getBySuffix) {
            await this.save();
            const entries = await this.storageProvider.getBySuffix(suffix);
            for (const [key, value] of entries) {
                this.cache.set(key, value);
            }
            return entries.map(([, value]) => value);
        }
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
        if (!(await this.isEnabled())) {
            return value();
        }
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
        if (!(await this.isEnabled())) {
            return defaultValue;
        }
        return this.getOrSet(key, async () => defaultValue);
    }

    async set(key: string, value: any, save: boolean = true) {
        if (!(await this.isEnabled())) {
            return;
        }
        if (!this.storageProvider.supportsPartialAccess && !this.loaded) {
            await this.load();
        }
        this.cache.set(key, value);
        this.pendingDeletes.delete(key);
        if (this.storageProvider.supportsPartialAccess && this.storageProvider.set) {
            if (save) {
                await this.storageProvider.set(key, value);
                this.dirtyKeys.delete(key);
            } else {
                this.dirtyKeys.add(key);
            }
            return;
        }
        if (save) {
            await this.save();
        }
    }

    async delete(key: string, save: boolean = true) {
        if (!this.storageProvider.supportsPartialAccess && !this.loaded) {
            await this.load();
        }
        this.cache.delete(key);
        this.dirtyKeys.delete(key);
        if (this.storageProvider.supportsPartialAccess) {
            if (save) {
                await this.storageProvider.delete(key);
                this.pendingDeletes.delete(key);
            } else {
                this.pendingDeletes.add(key);
            }
            return;
        }
        if (save) {
            await this.storageProvider.delete(key);
        }
    }

    async deletePrefix(prefix: string) {
        if (this.storageProvider.supportsPartialAccess && this.storageProvider.deletePrefix) {
            await this.storageProvider.deletePrefix(prefix);
            for (const key of this.cache.keys()) {
                if (key.startsWith(prefix)) {
                    this.cache.delete(key);
                }
            }
            for (const key of this.dirtyKeys) {
                if (key.startsWith(prefix)) {
                    this.dirtyKeys.delete(key);
                }
            }
            for (const key of this.pendingDeletes) {
                if (key.startsWith(prefix)) {
                    this.pendingDeletes.delete(key);
                }
            }
            return;
        }
        if (!this.loaded) {
            await this.load();
        }
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
        if (this.storageProvider.supportsPartialAccess && this.storageProvider.deleteSuffix) {
            await this.storageProvider.deleteSuffix(suffix);
            for (const key of this.cache.keys()) {
                if (key.endsWith(suffix)) {
                    this.cache.delete(key);
                }
            }
            for (const key of this.dirtyKeys) {
                if (key.endsWith(suffix)) {
                    this.dirtyKeys.delete(key);
                }
            }
            for (const key of this.pendingDeletes) {
                if (key.endsWith(suffix)) {
                    this.pendingDeletes.delete(key);
                }
            }
            return;
        }
        if (!this.loaded) {
            await this.load();
        }
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
        this.dirtyKeys.clear();
        this.pendingDeletes.clear();
        await this.storageProvider.clear();
    }

    async save() {
        if (this.storageProvider.supportsPartialAccess && this.storageProvider.set) {
            for (const key of this.pendingDeletes) {
                await this.storageProvider.delete(key);
            }
            this.pendingDeletes.clear();

            for (const key of this.dirtyKeys) {
                await this.storageProvider.set(key, this.cache.get(key));
            }
            this.dirtyKeys.clear();
            return;
        }
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
