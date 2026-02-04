import { $ } from "bun"
import { readdir } from "node:fs/promises"
import stripIndent from 'strip-indent'
import { fixTopField, getMigrationVersion, isInfoExist, updateMigrationVersion } from "./db-fix-top-field"

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
compatibility_date = "2026-01-20"

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
console.log(`Migrate visits to HyperLogLog format`)
await migrateVisitsToHLL(typ, DB_NAME);
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

// Migrate existing visits data to HyperLogLog format
async function migrateVisitsToHLL(typ: string, dbName: string) {
    console.log(`Checking if HyperLogLog migration is needed...`);
    
    try {
        // Check if visit_stats table has data
        const { stdout: countResult } = await $`bunx wrangler d1 execute ${dbName} --${typ} --command="SELECT COUNT(*) as count FROM visit_stats WHERE hll_data != ''"`.quiet();
        const migratedCount = parseInt(countResult.toString().match(/\d+/)?.[0] || '0');
        
        if (migratedCount > 0) {
            console.log(`  ${migratedCount} feeds already have HLL data. Migration may already be complete.`);
            return;
        }
        
        // Check if there are visits to migrate
        const { stdout: visitsCount } = await $`bunx wrangler d1 execute ${dbName} --${typ} --command="SELECT COUNT(*) as count FROM visits"`.quiet();
        const totalVisits = parseInt(visitsCount.toString().match(/\d+/)?.[0] || '0');
        
        if (totalVisits === 0) {
            console.log('  No visits to migrate. Skipping.');
            return;
        }
        
        console.log(`  Found ${totalVisits} visits to migrate to HyperLogLog format.`);
        console.log('  Starting migration...');
        
        // Get all unique feed_ids from visits
        const { stdout: feedIdsResult } = await $`bunx wrangler d1 execute ${dbName} --${typ} --command="SELECT DISTINCT feed_id FROM visits"`.quiet();
        const feedIds = feedIdsResult.toString()
            .split('\n')
            .filter(line => /^\d+$/.test(line.trim()))
            .map(id => parseInt(id.trim()));
        
        console.log(`  Processing ${feedIds.length} feeds...`);
        
        // Process each feed
        let processed = 0;
        for (const feedId of feedIds) {
            // Get all IPs for this feed
            const { stdout: ipsResult } = await $`bunx wrangler d1 execute ${dbName} --${typ} --command="SELECT ip FROM visits WHERE feed_id = ${feedId}"`.quiet();
            const ips = ipsResult.toString()
                .split('\n')
                .map(line => line.trim())
                .filter(line => line && !/^\d+$/.test(line) && line !== 'ip');
            
            if (ips.length === 0) continue;
            
            // Create HLL and add all IPs
            const hllData = await generateHLLData(ips);
            
            // Insert or update visit_stats
            const pv = ips.length;
            const uv = Math.round(await estimateUV(hllData));
            
            await $`bunx wrangler d1 execute ${dbName} --${typ} --command="INSERT OR REPLACE INTO visit_stats (feed_id, pv, hll_data, updated_at) VALUES (${feedId}, ${pv}, '${hllData}', ${Date.now() / 1000})"`.quiet();
            
            processed++;
            if (processed % 10 === 0) {
                console.log(`    Progress: ${processed}/${feedIds.length} feeds processed`);
            }
        }
        
        console.log(`\n✅ Migration completed! Processed ${processed} feeds.`);
        
    } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    }
}

// Generate HLL data from IPs (simplified version for D1 migration)
async function generateHLLData(ips: string[]): Promise<string> {
    // Import HyperLogLog dynamically
    const { HyperLogLog } = await import('../server/src/utils/hyperloglog');
    const hll = new HyperLogLog();
    for (const ip of ips) {
        hll.add(ip);
    }
    return hll.serialize();
}

// Estimate UV from HLL data
async function estimateUV(hllData: string): Promise<number> {
    const { HyperLogLog } = await import('../server/src/utils/hyperloglog');
    const hll = new HyperLogLog(hllData);
    return hll.count();
}