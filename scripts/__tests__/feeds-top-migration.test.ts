import { describe, expect, it } from "bun:test";
import { Database } from "bun:sqlite";
import {
  ADD_FEEDS_TOP_COLUMN_SQL,
  FEEDS_TABLE_EXISTS_QUERY,
  FEEDS_TOP_EXISTS_QUERY,
  fixTopField,
} from "../../cli/src/lib/db-migration";

const SQL_DIR = new URL("../../server/sql/", import.meta.url).pathname;

function splitStatements(sql: string): string[] {
  return sql
    .split("--> statement-breakpoint")
    .map((statement) => statement.replace(/^\s*--.*$/gm, "").trim())
    .filter(Boolean);
}

async function applyMigration(db: Database, fileName: string) {
  const sql = await Bun.file(`${SQL_DIR}${fileName}`).text();
  for (const statement of splitStatements(sql)) {
    db.exec(statement);
  }
}

function runTopFieldPreflight(db: Database) {
  if (!db.query(FEEDS_TABLE_EXISTS_QUERY).get()) {
    return;
  }

  if (!db.query(FEEDS_TOP_EXISTS_QUERY).get()) {
    db.exec(ADD_FEEDS_TOP_COLUMN_SQL);
  }
}

function getColumnNames(db: Database, table: string): string[] {
  return db
    .query(`PRAGMA table_info('${table}')`)
    .all()
    .map((row) => (row as { name: string }).name);
}

function getMigrationVersion(db: Database): string {
  const row = db.query("SELECT value FROM info WHERE key='migration_version'").get() as { value: string };
  return row.value;
}

function getVisibilityIndexColumns(db: Database): string[] {
  return db
    .query("PRAGMA index_info('feeds_visibility_order_idx')")
    .all()
    .map((row) => (row as { name: string }).name);
}

function createVersion10DatabaseWithoutTop(): Database {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE feeds (
      id INTEGER PRIMARY KEY,
      alias TEXT,
      draft INTEGER DEFAULT 1 NOT NULL,
      listed INTEGER DEFAULT 1 NOT NULL,
      uid INTEGER NOT NULL,
      created_at INTEGER,
      updated_at INTEGER
    );
    CREATE TABLE visits (feed_id INTEGER, created_at INTEGER);
    CREATE TABLE friends (accepted INTEGER, sort_order INTEGER, created_at INTEGER);
    CREATE TABLE users (openid TEXT);
    CREATE TABLE comments (feed_id INTEGER, created_at INTEGER);
    CREATE TABLE hashtags (name TEXT);
    CREATE TABLE feed_hashtags (feed_id INTEGER, hashtag_id INTEGER);
    CREATE TABLE cache (type TEXT, key TEXT);
    CREATE TABLE info (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    INSERT INTO info VALUES ('migration_version', '10');
  `);
  return db;
}

async function captureTopFieldPreflight(topExists: boolean, tableExists = true): Promise<string[]> {
  const originalSpawn = Bun.spawn;
  const mutableBun = Bun as typeof Bun & { spawn: typeof Bun.spawn };
  const commands: string[] = [];

  const spawnMock = ((args: string[]) => {
    const commandFlag = args.indexOf("--command");
    const command = commandFlag >= 0 ? args[commandFlag + 1] || "" : "";
    commands.push(command);

    let results: Array<{ name: string }> = [];
    if (command === FEEDS_TABLE_EXISTS_QUERY && tableExists) {
      results = [{ name: "feeds" }];
    } else if (command === FEEDS_TOP_EXISTS_QUERY && topExists) {
      results = [{ name: "top" }];
    }

    const stdout = command === ADD_FEEDS_TOP_COLUMN_SQL ? "" : JSON.stringify([{ results }]);
    return {
      stdout: new Blob([stdout]).stream(),
      stderr: new Blob([]).stream(),
      exited: Promise.resolve(0),
    };
  }) as unknown as typeof Bun.spawn;
  mutableBun.spawn = spawnMock;

  try {
    await fixTopField("local", "rin");
  } finally {
    mutableBun.spawn = originalSpawn;
  }

  return commands;
}

describe("feeds.top migration repair", () => {
  it("builds a fresh database through migration 0012", async () => {
    const db = new Database(":memory:");

    for (let version = 0; version <= 12; version += 1) {
      await applyMigration(db, `${version.toString().padStart(4, "0")}.sql`);
    }

    expect(getColumnNames(db, "feeds")).toContain("top");
    expect(getMigrationVersion(db)).toBe("12");
    expect(getVisibilityIndexColumns(db)).toEqual([
      "draft",
      "listed",
      "top",
      "created_at",
      "updated_at",
    ]);
    db.close();
  });

  it("repairs a missing top column before migration 0011 uses it", async () => {
    const db = createVersion10DatabaseWithoutTop();

    runTopFieldPreflight(db);
    await applyMigration(db, "0011.sql");
    await applyMigration(db, "0012.sql");

    const topColumn = db
      .query("PRAGMA table_info('feeds')")
      .all()
      .find((row) => (row as { name: string }).name === "top") as { notnull: number } | undefined;
    expect(topColumn?.notnull).toBe(1);
    expect(getMigrationVersion(db)).toBe("12");
    expect(getVisibilityIndexColumns(db)).toEqual([
      "draft",
      "listed",
      "top",
      "created_at",
      "updated_at",
    ]);
    db.close();
  });

  it("runs migration 0012 when top already exists", async () => {
    const db = new Database(":memory:");
    db.exec(`
      CREATE TABLE feeds (
        id INTEGER PRIMARY KEY,
        draft INTEGER DEFAULT 1 NOT NULL,
        listed INTEGER DEFAULT 1 NOT NULL,
        top INTEGER DEFAULT 0 NOT NULL,
        created_at INTEGER,
        updated_at INTEGER
      );
      CREATE INDEX feeds_visibility_order_idx ON feeds (draft, listed);
      CREATE TABLE info (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      INSERT INTO info VALUES ('migration_version', '11');
    `);

    await applyMigration(db, "0012.sql");

    expect(getMigrationVersion(db)).toBe("12");
    expect(getVisibilityIndexColumns(db)).toEqual([
      "draft",
      "listed",
      "top",
      "created_at",
      "updated_at",
    ]);
    db.close();
  });

  it("skips the preflight when feeds does not exist yet", async () => {
    const commands = await captureTopFieldPreflight(false, false);
    expect(commands).toEqual([FEEDS_TABLE_EXISTS_QUERY]);
  });

  it("does not add top when the preflight finds it", async () => {
    const commands = await captureTopFieldPreflight(true);
    expect(commands).toEqual([FEEDS_TABLE_EXISTS_QUERY, FEEDS_TOP_EXISTS_QUERY]);
  });

  it("adds top when the preflight cannot find it", async () => {
    const commands = await captureTopFieldPreflight(false);
    expect(commands).toEqual([FEEDS_TABLE_EXISTS_QUERY, FEEDS_TOP_EXISTS_QUERY, ADD_FEEDS_TOP_COLUMN_SQL]);
  });
});
