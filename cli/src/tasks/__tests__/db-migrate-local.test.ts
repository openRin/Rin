import { describe, expect, it } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

/**
 * resolveDbName 依赖 process.cwd() 下的 .env.local，
 * 这里临时切到可控目录来构造场景。
 */
function withCwd<T>(dir: string, fn: () => T): T {
  const original = process.cwd();
  process.chdir(dir);
  try {
    return fn();
  } finally {
    process.chdir(original);
  }
}

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "rin-dbname-"));
}

describe("resolveDbName", () => {
  it("prefers the explicit argument", async () => {
    const { resolveDbName } = await import("../db-migrate-local");
    const dir = makeTmpDir();
    fs.writeFileSync(path.join(dir, ".env.local"), "DB_NAME=from-env\n");

    expect(withCwd(dir, () => resolveDbName("explicit"))).toBe("explicit");
  });

  it("falls back to DB_NAME from .env.local", async () => {
    const { resolveDbName } = await import("../db-migrate-local");
    const dir = makeTmpDir();
    fs.writeFileSync(path.join(dir, ".env.local"), "DB_NAME=blog\n");

    expect(withCwd(dir, () => resolveDbName())).toBe("blog");
  });

  it("returns rin when nothing is configured", async () => {
    const { resolveDbName } = await import("../db-migrate-local");
    const dir = makeTmpDir();

    expect(withCwd(dir, () => resolveDbName())).toBe("rin");
  });
});