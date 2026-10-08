import * as fs from "node:fs";
import * as path from "node:path";
import { parseEnv } from "../lib/env";
import {
  fixTopField,
  getMigrationFileVersion,
  getMigrationVersion,
  updateMigrationVersion,
} from "../lib/db-migration";

/** 解析要操作的 D1 库名：显式参数 > .env.local 的 DB_NAME > "rin" */
export function resolveDbName(dbName?: string): string {
  if (dbName) {
    return assertValidDbName(dbName);
  }

  const envFile = path.join(process.cwd(), ".env.local");
  if (fs.existsSync(envFile)) {
    const fromEnv = parseEnv(fs.readFileSync(envFile, "utf-8")).DB_NAME;
    if (fromEnv) {
      return assertValidDbName(fromEnv);
    }
  }

  return "rin";
}

// D1 库名只允许标识符字符，防止 .env.local 写坏后脏值进入命令参数
function assertValidDbName(name: string): string {
  if (!/^[A-Za-z0-9_-]+$/.test(name)) {
    throw new Error(`Invalid D1 database name: "${name}" (allowed: letters, digits, "_" and "-")`);
  }
  return name;
}

/** 执行本地 D1 迁移。 */
export async function runLocalDbMigrate(dbName?: string) {
  const sqlDir = path.join(process.cwd(), "server", "sql");
  const targetDb = resolveDbName(dbName);

  const type = "local";
  const migrationVersion = await getMigrationVersion(type, targetDb);
  // Migration 0011 indexes feeds.top, so repair the column before pending SQL runs.
  await fixTopField(type, targetDb);
  const sqlFiles = fs
    .readdirSync(sqlDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
    .map((entry) => entry.name)
    .filter((file) => {
      const version = getMigrationFileVersion(file);
      return version !== null && version > migrationVersion;
    })
    .sort((left, right) => {
      return (getMigrationFileVersion(left) || 0) - (getMigrationFileVersion(right) || 0);
    });

  console.log("migration_version:", migrationVersion, "Migration SQL List: ", sqlFiles);

  for (const file of sqlFiles) {
    const filePath = path.join(sqlDir, file);
    try {
      const proc = Bun.spawn([process.execPath, "x", "wrangler", "d1", "execute", targetDb, "--local", "--file", filePath], {
        stdin: "inherit",
        stdout: "inherit",
        stderr: "inherit",
      });
      const exitCode = await proc.exited;
      if (exitCode !== 0) {
        throw new Error(`wrangler exited with code ${exitCode}`);
      }
      console.log(`Executed ${file}`);
    } catch (error) {
      console.error(`Failed to execute ${file}: ${error}`);
      process.exit(1);
    }
  }

  if (sqlFiles.length === 0) {
    console.log("No migration needed.");
  } else {
    const lastVersion = getMigrationFileVersion(sqlFiles[sqlFiles.length - 1] || "");
    if (lastVersion !== null && lastVersion > migrationVersion) {
      await updateMigrationVersion(type, targetDb, lastVersion);
    }
  }
}
