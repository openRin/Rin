import { PutObjectCommand } from "@aws-sdk/client-s3";
import path from "path";
import Container, { Service } from "typedi";
import type { DB } from "../_worker";
import type { Env } from "../db/db";
import { getDB, getEnv } from "./di";
import { createS3Client } from "./s3";

// Cache Utils for storing data in memory and persisting to S3
// DO NOT USE THIS TO STORE SENSITIVE DATA

@Service()
export class CacheImpl {
    cache: Map<string, any> = new Map<string, any>();
    db: DB;
    env: Env;
    cacheUrl: string;
    type: string;
    s3 = createS3Client();
    constructor(type: string = "cache") {
        this.type = type;
        this.db = getDB();
        this.env = getEnv();
        this.cache = new Map<string, any>();
        console.log('Cache created', type);
        this.cacheUrl = path.join(this.env.S3_ACCESS_HOST, this.env.S3_CACHE_FOLDER || 'cache', `${type}.json`);
        fetch(this.cacheUrl).then(response => response.json<any>()).then(data => {
            for (let key in data) {
                this.cache.set(key, data[key]);
            }
        });
    }
    all() {
        return this.cache;
    }
    get(key: string) {
        return this.cache.get(key);
    }
    async getOrSet<T>(key: string, value: () => Promise<T>) {
        const cached = this.cache.get(key)
        if (cached) {
            console.log('Cache hit', key);
            return cached as T;
        }
        console.log('Cache miss', key);
        const newValue = await value();
        this.set(key, newValue);
        return newValue;
    }

    set(key: string, value: any, save: boolean = true) {
        this.cache.set(key, value);
        console.log('Cache set', key);
        if (save) {
            this.save();
        }
    }

    delete(key: string, save: boolean = true) {
        this.cache.delete(key);
        if (save) {
            this.save();
        }
    }

    deletePrefix(prefix: string) {
        for (let key of this.cache.keys()) {
            if (key.startsWith(prefix)) {
                this.delete(key, false);
            }
        }
        this.save();
    }

    clear() {
        this.cache.clear();
        this.save();
    }

    async save() {
        const cacheKey = path.join(this.env.S3_CACHE_FOLDER, `${this.type}.json`);
        await this.s3.send(new PutObjectCommand({
            Bucket: this.env.S3_BUCKET,
            Key: cacheKey,
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

export const PublicCache = () => Container.get<CacheImpl>("cache");
export const ServerConfig = () => Container.get<CacheImpl>("server.config");
export const ClientConfig = () => Container.get<CacheImpl>("client.config");