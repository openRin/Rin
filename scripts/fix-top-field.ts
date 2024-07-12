import { $ } from "bun"

export async function fixTopField(isLocal: boolean, db: string, isInfoExistResult: boolean) {
    const typ = isLocal ? "local" : "remote"
    if (!isInfoExistResult) {
        console.log("Legacy database, check top field")
        const result = await $`bunx wrangler d1 execute ${db}  --${typ} --json --command "SELECT name FROM pragma_table_info('feeds') WHERE name='top'"`.quiet().json()
        if (result[0].results.length === 0) {
            console.log("Adding top field to feeds table")
            await $`bunx wrangler d1 execute ${db}  --${typ} --json --command "ALTER TABLE feeds ADD COLUMN top INTEGER DEFAULT 0"`.quiet()
        } else {
            console.log("Top field already exists in feeds table")
        }
    } else {
        console.log("New database, skip top field check")
    }
}

export async function isInfoExist(isLocal: boolean, db: string) {
    const typ = isLocal ? "local" : "remote"
    const result = await $`bunx wrangler d1 execute ${db}  --${typ} --json --command "SELECT name FROM sqlite_master WHERE type='table' AND name='info'"`.quiet().json()
    if (result[0].results.length === 0) {
        console.log("info table not exists")
        return false
    } else {
        console.log("info table already exists")
        return true
    }
}

export async function getMigrationVersion(isLocal: boolean, db: string) {
    const isInfoExistResult = await isInfoExist(isLocal, db)
    if (!isInfoExistResult) {
        console.log("Legacy database, migration_version not exists")
        return -1
    }
    const typ = isLocal ? "local" : "remote"
    const result = await $`bunx wrangler d1 execute ${db}  --${typ} --json --command "SELECT value FROM info WHERE key='migration_version'"`.quiet().json()
    if (result[0].results.length === 0) {
        console.log("migration_version not exists")
        return -1
    } else {
        console.log("migration_version:", result[0].results[0].value)
        return parseInt(result[0].results[0].value)
    }
}

export async function updateMigrationVersion(isLocal: boolean, db: string, version: number) {
    const typ = isLocal ? "local" : "remote"
    const exists = await isInfoExist(isLocal, db)
    if (!exists) {
        console.log("info table not exists, skip update migration_version")
        throw new Error("info table not exists")
    }
    await $`bunx wrangler d1 execute ${db}  --${typ} --json --command "UPDATE info SET value='${version}' WHERE key='migration_version'"`.quiet()
    console.log("Updated migration_version to", version)
}