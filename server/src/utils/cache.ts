import { PutObjectCommand } from "@aws-sdk/client-s3";
import path from "path";
import type { DB } from "../_worker";
import type { Env } from "../db/db";
import { getDB, getEnv } from "./di";
import { createS3Client } from "./s3";
import Container, { Service } from "typedi";
// Cache Utils for storing data in memory and persisting to S3
// DO NOT USE THIS TO STORE SENSITIVE DATA
export const PublicCache = () => Container.get(CacheImpl);
@Service()
class CacheImpl {
    cache: Map<string, any> = new Map<string, any>();
    db: DB;
    env: Env;
    cacheUrl: string;
    constructor() {
        this.db = getDB();
        this.env = getEnv();
        this.cache = new Map<string, any>();
        this.cacheUrl = path.join(this.env.S3_ACCESS_HOST, this.env.S3_CACHE_FOLDER || 'cache/', 'cache.json');
        fetch(this.cacheUrl).then(response => response.json<any>()).then(data => {
            for (let key in data) {
                this.cache.set(key, data[key]);
            }
        });

        const destructor = this.destructor.bind(this);
        const weakRef = new WeakRef(this);
        // add a cleanup callback to the global object
        const cleanupCallback = () => {
            const object = weakRef.deref();
            if (object) {
                destructor();
            }
        };
        (globalThis as any).gc?.(cleanupCallback);
    }
    get(key: string) {
        return this.cache.get(key);
    }
    async getOrSet<T>(key: string, value: () => Promise<T>) {
        const cached = this.cache.get(key)
        if (cached) {
            return cached as T;
        }
        const newValue = await value();
        this.cache.set(key, newValue);
        return newValue;
    }
    set(key: string, value: any) {
        this.cache.set(key, value);
    }
    delete(key: string) {
        this.cache.delete(key);
    }
    deletePrefix(prefix: string) {
        for (let key of this.cache.keys()) {
            if (key.startsWith(prefix)) {
                this.cache.delete(key);
            }
        }
    }
    clear() {
        this.cache.clear();
    }

    async save() {
        const s3 = createS3Client();
        s3.send(new PutObjectCommand({
            Bucket: this.env.S3_BUCKET,
            Key: this.env.S3_CACHE_FOLDER + '/cache.json',
            Body: JSON.stringify(Object.fromEntries(this.cache))
        })).then(() => {
            console.log('Cache saved');
        }).catch((e: any) => {
            console.error('Cache save failed')
            console.error(e.message);
        });
    }

    destructor() {
        this.save();
    }
}