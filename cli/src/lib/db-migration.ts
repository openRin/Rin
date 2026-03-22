import { getWranglerEnv } from "./wrangler";

const bunExec = process.execPath;
const wranglerCwd = "server";

export function getMigrationFileVersion(fileName: string) {
  const match = /^(\d+)(?:\D.*)?\.sql$/i.exec(fileName.trim());
  if (!match) {
    return null;
  }

  return Number.parseInt(match[1] || "", 10);
}

async function runWranglerJson(args: string[]) {
  const proc = Bun.spawn([bunExec, "x", "wrangler", ...args], {
    cwd: wranglerCwd,
    env: getWranglerEnv(),
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);

  if (exitCode !== 0) {
    throw new Error(stderr.trim() || stdout.trim() || `wrangler failed with exit code ${exitCode}`);
  }

  return JSON.parse(stdout);
}

async function runWranglerQuiet(args: string[]) {
  const proc = Bun.spawn([bunExec, "x", "wrangler", ...args], {
    cwd: wranglerCwd,
    env: getWranglerEnv(),
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);

  if (exitCode !== 0) {
    throw new Error(stderr.trim() || stdout.trim() || `wrangler failed with exit code ${exitCode}`);
  }
}

export async function fixTopField(type: "local" | "remote", db: string, infoExists: boolean) {
  if (infoExists) {
    console.log("New database, skip top field check");
    return;
  }

  console.log("Legacy database, check top field");
  const result = await runWranglerJson([
    "d1",
    "execute",
    db,
    `--${type}`,
    "--json",
    "--command",
    "SELECT name FROM pragma_table_info('feeds') WHERE name='top'",
  ]);

  if (result[0].results.length === 0) {
    console.log("Adding top field to feeds table");
    await runWranglerQuiet([
      "d1",
      "execute",
      db,
      `--${type}`,
      "--json",
      "--command",
      "ALTER TABLE feeds ADD COLUMN top INTEGER DEFAULT 0",
    ]);
  } else {
    console.log("Top field already exists in feeds table");
  }
}

export async function isInfoExist(type: "local" | "remote", db: string) {
  const result = await runWranglerJson([
    "d1",
    "execute",
    db,
    `--${type}`,
    "--json",
    "--command",
    "SELECT name FROM sqlite_master WHERE type='table' AND name='info'",
  ]);

  if (result[0].results.length === 0) {
    console.log("info table not exists");
    return false;
  }

  console.log("info table already exists");
  return true;
}

export async function getMigrationVersion(type: "local" | "remote", db: string) {
  const infoExists = await isInfoExist(type, db);
  if (!infoExists) {
    console.log("Legacy database, migration_version not exists");
    return -1;
  }

  const result = await runWranglerJson([
    "d1",
    "execute",
    db,
    `--${type}`,
    "--json",
    "--command",
    "SELECT value FROM info WHERE key='migration_version'",
  ]);

  if (result[0].results.length === 0) {
    console.log("migration_version not exists");
    return -1;
  }

  console.log("migration_version:", result[0].results[0].value);
  return parseInt(result[0].results[0].value);
}

export async function updateMigrationVersion(type: "local" | "remote", db: string, version: number) {
  const infoExists = await isInfoExist(type, db);
  if (!infoExists) {
    console.log("info table not exists, skip update migration_version");
    throw new Error("info table not exists");
  }

  await runWranglerQuiet([
    "d1",
    "execute",
    db,
    `--${type}`,
    "--json",
    "--command",
    `UPDATE info SET value='${version}' WHERE key='migration_version'`,
  ]);
  console.log("Updated migration_version to", version);
}
