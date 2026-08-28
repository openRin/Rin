import { describe, it, expect } from 'bun:test';
import { Database } from 'bun:sqlite';
import { getMigrationFileVersion } from '../../cli/src/lib/db-migration';

const SQL_DIR = new URL('../../server/sql/', import.meta.url).pathname;

function splitStatements(sql: string): string[] {
    return sql
        .split('--> statement-breakpoint')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
}

/** Build a database in the broken state: migrated to 0011 but without feeds.top. */
function createBrokenDatabase(): Database {
    const db = new Database(':memory:');
    db.exec(`
        CREATE TABLE users (id integer PRIMARY KEY NOT NULL, openid text);
        CREATE TABLE feeds (
            id integer PRIMARY KEY NOT NULL,
            alias text, title text, content text NOT NULL,
            summary text DEFAULT '' NOT NULL,
            listed integer DEFAULT 1 NOT NULL,
            draft integer DEFAULT 1 NOT NULL,
            uid integer NOT NULL,
            created_at integer, updated_at integer
        );
        CREATE TABLE info (key text NOT NULL, value text NOT NULL);
        INSERT INTO info (key, value) VALUES ('migration_version', '11');
        INSERT INTO feeds (id, title, content, uid) VALUES (1, 'a', 'x', 1);
    `);
    return db;
}

describe('feeds.top 迁移修复', () => {
    it('0011.sql 在没有 top 列时会失败，复现原始缺陷', async () => {
        const db = createBrokenDatabase();
        const sql = await Bun.file(`${SQL_DIR}0011.sql`).text();
        const stmts = splitStatements(sql);
        // 只取 feeds_visibility_order_idx 这条语句（其它建索引语句与本缺陷无关）
        const idxStmt = stmts.find((s) => s.includes('feeds_visibility_order_idx'))!;
        expect(() => db.exec(idxStmt)).toThrow();
        db.close();
    });

    it('0012.sql 能修复缺失的 top 列并重建索引', async () => {
        const db = createBrokenDatabase();
        const sql = await Bun.file(`${SQL_DIR}0012.sql`).text();
        for (const stmt of splitStatements(sql)) {
            db.exec(stmt);
        }

        const columns = db
            .query("PRAGMA table_info('feeds')")
            .all()
            .map((r) => (r as { name: string }).name);
        expect(columns).toContain('top');

        const version = db
            .query("SELECT value FROM info WHERE key='migration_version'")
            .get() as { value: string };
        expect(version.value).toBe('12');

        const idxCols = db
            .query("PRAGMA index_info('feeds_visibility_order_idx')")
            .all()
            .map((r) => (r as { name: string }).name);
        expect(idxCols).toEqual(['draft', 'listed', 'top', 'created_at', 'updated_at']);

        db.close();
    });

    it('0012.sql 只会在版本号低于 12 的数据库上执行', () => {
        const files = ['0011.sql', '0012.sql'];
        // 模拟 runner 的过滤逻辑：version > migrationVersion
        const select = (migrationVersion: number) =>
            files.filter((f) => {
                const v = getMigrationFileVersion(f);
                return v !== null && v > migrationVersion;
            });

        // 尚未升级到 0011 的库：0011、0012 都会执行
        expect(select(10)).toEqual(['0011.sql', '0012.sql']);
        // 已经卡在 0011 的库：0012 仍会执行，这正是修改 0011 无法覆盖的场景
        expect(select(11)).toEqual(['0012.sql']);
        // 已修复的库：不再重复执行
        expect(select(12)).toEqual([]);
    });
});
