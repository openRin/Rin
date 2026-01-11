import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

/**
 * 跨平台的 Shell 执行器
 * 自动识别 Bun 或 Node 环境
 */
async function runCommand(cmd: string): Promise<any> {
  // 检测是否在 Bun 环境中
  const isBun = typeof Bun !== "undefined";

  if (isBun) {
    // 动态导入 Bun 的 $ 以避免在 Node 中解析错误
    const { $ } = await import("bun");
    // 使用 bunx，并静默执行获取 JSON
    return await $`${{ raw: cmd }}`.quiet().json();
  } else {
    // Node 环境逻辑
    // 将 bunx 替换为 npx (如果命令里包含 bunx)
    const nodeCmd = cmd.replace(/^bunx /, "npx ");
    try {
      const { stdout } = await execAsync(nodeCmd);
      return JSON.parse(stdout);
    } catch (e: any) {
      // 模拟 Bun 的报错行为或处理空输出
      if (e.stdout) return JSON.parse(e.stdout);
      throw e;
    }
  }
}

export async function fixTopField(typ: 'local' | 'remote', db: string, isInfoExistResult: boolean) {
    if (!isInfoExistResult) {
        console.log("Legacy database, check top field")
        const cmd = `bunx wrangler d1 execute ${db} --${typ} --json --command "SELECT name FROM pragma_table_info('feeds') WHERE name='top'"`
        const result = await runCommand(cmd);
        
        if (result[0].results.length === 0) {
            console.log("Adding top field to feeds table")
            const addColCmd = `bunx wrangler d1 execute ${db} --${typ} --json --command "ALTER TABLE feeds ADD COLUMN top INTEGER DEFAULT 0"`
            await runCommand(addColCmd);
        } else {
            console.log("Top field already exists in feeds table")
        }
    } else {
        console.log("New database, skip top field check")
    }
}

export async function isInfoExist(typ: 'local' | 'remote', db: string) {
    const cmd = `bunx wrangler d1 execute ${db} --${typ} --json --command "SELECT name FROM sqlite_master WHERE type='table' AND name='info'"`
    const result = await runCommand(cmd);
    
    if (result[0]?.results?.length === 0) {
        console.log("info table not exists")
        return false
    } else {
        console.log("info table already exists")
        return true
    }
}

export async function getMigrationVersion(typ: 'local' | 'remote', db: string) {
    const isInfoExistResult = await isInfoExist(typ, db)
    if (!isInfoExistResult) {
        console.log("Legacy database, migration_version not exists")
        return -1
    }
    const cmd = `bunx wrangler d1 execute ${db} --${typ} --json --command "SELECT value FROM info WHERE key='migration_version'"`
    const result = await runCommand(cmd);
    
    if (result[0]?.results?.length === 0) {
        console.log("migration_version not exists")
        return -1
    } else {
        console.log("migration_version:", result[0]?.results?.[0]?.value)
        return parseInt(result[0]?.results?.[0].value)
    }
}

export async function updateMigrationVersion(typ: 'local' | 'remote', db: string, version: number) {
    const exists = await isInfoExist(typ, db)
    if (!exists) {
        console.log("info table not exists, skip update migration_version")
        throw new Error("info table not exists")
    }
    const cmd = `bunx wrangler d1 execute ${db} --${typ} --json --command "UPDATE info SET value='${version}' WHERE key='migration_version'"`
    await runCommand(cmd);
    console.log("Updated migration_version to", version)
}