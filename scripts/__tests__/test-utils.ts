/// <reference types="../../server/worker-configuration" />

/**
 * 测试工具库
 * 提供共享的测试辅助函数和 mock 数据生成器
 */

import { drizzle } from 'drizzle-orm/bun-sqlite';
import { Database } from 'bun:sqlite';

// 类型定义
export type CacheStorageMode = 'database' | 's3';

/**
 * 创建内存测试数据库
 */
export function createTestDB() {
    const sqlite = new Database(':memory:');
    const db = drizzle(sqlite);
    
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

/**
 * 创建模拟环境变量
 */
export function createMockEnv(storageMode: CacheStorageMode = 'database'): Env {
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

/**
 * Wrangler JSON 输出解析工具
 */
export const WranglerParsers = {
    /**
     * 解析 count 查询结果
     */
    parseCount(stdout: string): number {
        try {
            const json = JSON.parse(stdout);
            if (Array.isArray(json) && json.length > 0 && json[0].results && json[0].results.length > 0) {
                return parseInt(json[0].results[0].count) || 0;
            }
        } catch (e) {
            const match = stdout.match(/"count":\s*(\d+)/);
            if (match) {
                return parseInt(match[1]) || 0;
            }
        }
        return 0;
    },

    /**
     * 解析 feed_id 列表
     */
    parseFeedIds(stdout: string): number[] {
        try {
            const json = JSON.parse(stdout);
            if (Array.isArray(json) && json.length > 0 && json[0].results) {
                return json[0].results
                    .map((row: any) => parseInt(row.feed_id))
                    .filter((id: number) => !isNaN(id));
            }
        } catch (e) {
            return stdout
                .split('\n')
                .map(line => line.trim())
                .filter(line => /^\d+$/.test(line))
                .map(id => parseInt(id));
        }
        return [];
    },

    /**
     * 解析 IP 列表
     */
    parseIPs(stdout: string): string[] {
        try {
            const json = JSON.parse(stdout);
            if (Array.isArray(json) && json.length > 0 && json[0].results) {
                return json[0].results
                    .map((row: any) => row.ip)
                    .filter((ip: string) => ip && typeof ip === 'string');
            }
        } catch (e) {
            // Fallback: 解析旧格式输出
            return stdout
                .split('\n')
                .map(line => line.trim())
                .filter(line => line && !/^\d+$/.test(line) && line !== 'ip')
                .filter(line => /^(\d{1,3}\.){3}\d{1,3}$/.test(line) || line.includes(':'));
        }
        return [];
    }
};

/**
 * HLL 测试数据生成器
 */
export const HLLTestData = {
    /**
     * 生成唯一 IP 列表
     */
    generateUniqueIPs(count: number): string[] {
        const ips: string[] = [];
        for (let i = 0; i < count; i++) {
            const segment1 = Math.floor(i / Math.pow(256, 3)) % 256;
            const segment2 = Math.floor(i / Math.pow(256, 2)) % 256;
            const segment3 = Math.floor(i / 256) % 256;
            const segment4 = i % 256;
            const segment5 = Math.floor(i / Math.pow(256, 5)) % 256;
            const segment6 = Math.floor(i / Math.pow(256, 6)) % 256;
            
            if (i % 3 === 0) {
                ips.push(`${segment1}.${segment2}.${segment3}.${segment4}`);
            } else if (i % 3 === 1) {
                const hex1 = (segment1 * 256 + segment2).toString(16).padStart(4, '0');
                const hex2 = (segment3 * 256 + segment4).toString(16).padStart(4, '0');
                ips.push(`2001:0db8:${hex1}:${hex2}::1`);
            } else {
                const port = 1000 + (i % 60000);
                ips.push(`${segment5}.${segment6}.${segment3}.${segment4}:${port}`);
            }
        }
        return ips;
    },

    /**
     * 生成带重复的 IP 列表
     */
    generateIPsWithDuplicates(uniqueCount: number, duplicateRatio: number): string[] {
        const ips: string[] = [];
        const uniqueIPs = this.generateUniqueIPs(uniqueCount);

        for (const ip of uniqueIPs) {
            ips.push(ip);
        }

        const duplicateCount = Math.floor(uniqueCount * duplicateRatio);
        for (let i = 0; i < duplicateCount; i++) {
            const randomIndex = Math.floor(Math.random() * uniqueCount);
            ips.push(uniqueIPs[randomIndex]);
        }

        // 打乱顺序
        for (let i = ips.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            const temp = ips[i];
            ips[i] = ips[j];
            ips[j] = temp;
        }

        return ips;
    }
};

/**
 * 计算相对误差
 */
export function calculateRelativeError(actual: number, expected: number): number {
    if (expected === 0) return 0;
    return Math.abs(actual - expected) / expected;
}
