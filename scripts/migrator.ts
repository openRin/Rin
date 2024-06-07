import { $ } from "bun";
import { readdir } from "node:fs/promises";
import stripIndent from 'strip-indent';

const env = process.env
const DB_NAME = env.DB_NAME || 'rin'
const WORKER_NAME = env.WORKER_NAME || 'rin-server'
const FRONTEND_URL = env.FRONTEND_URL || ""
const S3_FOLDER = env.S3_FOLDER || 'images/'
const S3_CACHE_FOLDER = env.S3_CACHE_FOLDER || 'cache/'

const region = env.S3_REGION;
const endpoint = env.S3_ENDPOINT;
const accessHost = env.S3_ACCESS_HOST || endpoint;
const bucket = env.S3_BUCKET;

if (!region) {
    console.error('S3_REGION is not defined')
    process.exit(1)
}
if (!endpoint) {
    console.error('S3_ENDPOINT is not defined')
    process.exit(1)
}
if (!bucket) {
    console.error('S3_BUCKET is not defined')
    process.exit(1)
}

// Secrets
const accessKeyId = env.S3_ACCESS_KEY_ID;
const secretAccessKey = env.S3_SECRET_ACCESS_KEY;
const jwtSecret = env.JWT_SECRET;
const githubClientId = env.GITHUB_CLIENT_ID;
const githubClientSecret = env.GITHUB_CLIENT_SECRET;

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
S3_REGION = "${region}"
S3_ENDPOINT = "${endpoint}"
S3_ACCESS_HOST = "${accessHost}"
S3_BUCKET = "${bucket}"

[placement]
mode = "smart"
`))

type D1Item = {
    uuid: string,
    name: string,
    version: string,
    created_at: string,
}

const { exitCode, stderr } = await $`bunx wrangler d1 create ${DB_NAME}`.quiet().nothrow()
if (exitCode !== 0) {
    if (!stderr.toString().includes('already exists')) {
        console.error(`Failed to create D1 "${DB_NAME}"`)
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
try {
    const files = await readdir("./server/sql", { recursive: false });
    for (const file of files) {
        await $`bunx wrangler d1 execute ${DB_NAME} --remote --file ./server/sql/${file} -y`
        console.log(`Migrated ${file}`)
    }
} catch (e: any) {
    console.error(e.stderr.toString())
    process.exit(1)
}

console.log(`Migrated D1 "${DB_NAME}"`)
console.log(`----------------------------`)
console.log(`Put secrets`)

async function putSecret(name: string, value?: string) {
    if (value) {
        console.log(`Put ${name}`)
        await $`echo "${value}" | bun wrangler secret put ${name}`
    }
}

await putSecret('S3_ACCESS_KEY_ID', accessKeyId)
await putSecret('S3_SECRET_ACCESS_KEY', secretAccessKey)
await putSecret('GITHUB_CLIENT_ID', githubClientId)
await putSecret('GITHUB_CLIENT_SECRET', githubClientSecret)
await putSecret('JWT_SECRET', jwtSecret)

console.log(`Put Done.`)
console.log(`----------------------------`)
console.log(`Deploying`)
await $`echo -e "n\ny\n" | bunx wrangler deploy`
console.log(`Deployed`)
console.log(`----------------------------`)
console.log(`🎉All Done.`)