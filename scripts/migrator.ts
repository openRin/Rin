import { $ } from "bun"
import { readdir } from "node:fs/promises"
import stripIndent from 'strip-indent'
import { fixTopField, getMigrationVersion, isInfoExist, updateMigrationVersion } from "./fix-top-field"

function env(name: string, defaultValue?: string, required = false) {
    const env = process.env
    const value = env[name] || defaultValue
    if (required && !value) {
        throw new Error(`${name} is not defined`)
    }
    return value
}

// must be defined
const renv = (name: string, defaultValue?: string) => env(name, defaultValue, true)!

const DB_NAME = renv("DB_NAME", 'rin')
const WORKER_NAME = renv("WORKER_NAME", 'rin-server')
const FRONTEND_URL = env("FRONTEND_URL", "")

const S3_ENDPOINT = env("S3_ENDPOINT", "")
const S3_ACCESS_HOST = env("S3_ACCESS_HOST", S3_ENDPOINT)
const S3_BUCKET = env("S3_BUCKET", "")
const S3_CACHE_FOLDER = renv("S3_CACHE_FOLDER", 'cache/')
const S3_FOLDER = renv("S3_FOLDER", 'images/')
const S3_REGION = renv("S3_REGION", "auto")
const S3_FORCE_PATH_STYLE = env("S3_FORCE_PATH_STYLE", "false")
const WEBHOOK_URL = env("WEBHOOK_URL", "")
const RSS_TITLE = env("RSS_TITLE", "")
const RSS_DESCRIPTION = env("RSS_DESCRIPTION", "")

// Secrets
const accessKeyId = env("S3_ACCESS_KEY_ID")
const secretAccessKey = env("S3_SECRET_ACCESS_KEY")
const jwtSecret = env("JWT_SECRET")
const githubClientId = env("RIN_GITHUB_CLIENT_ID")
const githubClientSecret = env("RIN_GITHUB_CLIENT_SECRET")

Bun.write('wrangler.toml', stripIndent(`
#:schema node_modules/wrangler/config-schema.json
name = "${WORKER_NAME}"
main = "server/src/_worker.ts"
compatibility_date = "2024-05-29"
# compatibility_flags = ["nodejs_compat"]
node_compat = true

[triggers]
crons = ["*/20 * * * *"]

[vars]
FRONTEND_URL = "${FRONTEND_URL}"
S3_FOLDER = "${S3_FOLDER}"
S3_CACHE_FOLDER="${S3_CACHE_FOLDER}"
S3_REGION = "${S3_REGION}"
S3_ENDPOINT = "${S3_ENDPOINT}"
S3_ACCESS_HOST = "${S3_ACCESS_HOST}"
S3_BUCKET = "${S3_BUCKET}"
S3_FORCE_PATH_STYLE = "${S3_FORCE_PATH_STYLE}"
WEBHOOK_URL = "${WEBHOOK_URL}"
RSS_TITLE = "${RSS_TITLE}"
RSS_DESCRIPTION = "${RSS_DESCRIPTION}"

[placement]
mode = "smart"
`))

type D1Item = {
    uuid: string,
    name: string,
    version: string,
    created_at: string,
}

const { exitCode, stderr, stdout } = await $`bunx wrangler d1 create ${DB_NAME}`.quiet().nothrow()
if (exitCode !== 0) {
    if (!stderr.toString().includes('already exists')) {
        console.error(`Failed to create D1 "${DB_NAME}"`)
        console.error(stripIndent(stdout.toString()))
        console.log(`----------------------------`)
        console.error(stripIndent(stderr.toString()))
        process.exit(1)
    } else {
        console.log(`D1 "${DB_NAME}" already exists.`)
    }
} else {
    console.log(`Created D1 "${DB_NAME}"`)
}
console.log(`Searching D1 "${DB_NAME}"`)
const listJsonString = await $`bunx wrangler d1 list --json`.quiet().text()
const listJson = JSON.parse(listJsonString) as D1Item[] ?? []
const existing = listJson.find((x: D1Item) => x.name === DB_NAME)
if (existing) {
    console.log(`Found: ${existing.name}:${existing.uuid}`)
    // append to the end of the file
    const configText = stripIndent(`
    [[d1_databases]]
    binding = "DB"
    database_name = "${existing.name}"
    database_id = "${existing.uuid}"`)
    await $`echo ${configText} >> wrangler.toml`.quiet()
    console.log(`Appended to wrangler.toml`)
}

console.log(`----------------------------`)
console.log(`Migrating D1 "${DB_NAME}"`)
const typ = 'remote';
const migrationVersion = await getMigrationVersion(typ, DB_NAME);
const isInfoExistResult = await isInfoExist(typ, DB_NAME);

try {
    const files = await readdir("./server/sql", { recursive: false })
    const sqlFiles = files
        .filter(name => name.endsWith('.sql'))
        .filter(name => {
            const version = parseInt(name.split('-')[0]);
            return version > migrationVersion;
        })
        .sort();
    console.log("migration_version:", migrationVersion, "Migration SQL List: ", sqlFiles)
    for (const file of sqlFiles) {
        await $`bunx wrangler d1 execute ${DB_NAME} --remote --file ./server/sql/${file} -y`
        console.log(`Migrated ${file}`)
    }
    if (sqlFiles.length === 0) {
        console.log("No migration needed.")
    } else {
        const lastVersion = parseInt(sqlFiles[sqlFiles.length - 1].split('-')[0]);
        if (lastVersion > migrationVersion) {
            // Update the migration version
            await updateMigrationVersion(typ, DB_NAME, lastVersion);
        }
    }
} catch (e: any) {
    console.error(e.stdio?.toString())
    console.error(e.stdout?.toString())
    console.error(e.stderr?.toString())
    process.exit(1)
}

console.log(`Migrated D1 "${DB_NAME}"`)
console.log(`----------------------------`)
console.log(`Patch D1`)
await fixTopField(typ, DB_NAME, isInfoExistResult);
console.log(`----------------------------`)
console.log(`Put secrets`)

async function putSecret(name: string, value?: string) {
    if (value) {
        console.log(`Put ${name}`)
        await $`echo "${value}" | bun wrangler secret put ${name}`
    } else {
        console.log(`Skip ${name}, value is not defined.`)
    }
}

await putSecret('S3_ACCESS_KEY_ID', accessKeyId)
await putSecret('S3_SECRET_ACCESS_KEY', secretAccessKey)
await putSecret('RIN_GITHUB_CLIENT_ID', githubClientId)
await putSecret('RIN_GITHUB_CLIENT_SECRET', githubClientSecret)
await putSecret('JWT_SECRET', jwtSecret)

console.log(`Put Done.`)
console.log(`----------------------------`)
console.log(`Deploying`)
await $`echo -e "n\ny\n" | bunx wrangler deploy`
console.log(`Deployed`)
console.log(`----------------------------`)
console.log(`🎉All Done.`)