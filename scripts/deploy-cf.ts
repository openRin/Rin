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
const PAGES_NAME = renv("PAGES_NAME", 'rin-client')
const FRONTEND_URL = env("FRONTEND_URL", "")

// Auto-discover R2 bucket if not specified
const R2_BUCKET_NAME = env("R2_BUCKET_NAME", "rin-storage")

// S3 configuration (optional - will use R2 if not specified)
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
const adminUsername = env("ADMIN_USERNAME")
const adminPassword = env("ADMIN_PASSWORD")

// Frontend build configuration
const NAME = env("NAME", "Rin")
const DESCRIPTION = env("DESCRIPTION", "A lightweight personal blogging system")
const AVATAR = env("AVATAR", "")
const PAGE_SIZE = env("PAGE_SIZE", "5")
const RSS_ENABLE = env("RSS_ENABLE", "false")

async function getR2BucketInfo(): Promise<{ name: string; endpoint: string; accessHost: string } | null> {
    try {
        // If R2 bucket name is explicitly provided, use it
        if (R2_BUCKET_NAME) {
            console.log(`Using specified R2 bucket: ${R2_BUCKET_NAME}`)
            return {
                name: R2_BUCKET_NAME,
                endpoint: `https://${R2_BUCKET_NAME}.${process.env.CF_ACCOUNT_ID}.r2.cloudflarestorage.com`,
                accessHost: `https://${R2_BUCKET_NAME}.${process.env.CF_ACCOUNT_ID}.r2.cloudflarestorage.com`
            }
        }

        // Try to auto-discover R2 bucket
        console.log("Auto-discovering R2 bucket...")
        const { stdout } = await $`bunx wrangler r2 bucket list`.quiet()
        
        // Parse the output - wrangler r2 bucket list doesn't have --json flag
        // Output format is typically:
        // Name    Created
        // bucket1 2024-01-01...
        // bucket2 2024-01-02...
        const lines = stdout.toString().split('\n').filter(line => line.trim())
        
        // Skip header line (starts with "Name" or contains "Created")
        const bucketLines = lines.filter(line => 
            !line.startsWith('Name') && 
            !line.includes('Created') &&
            line.trim().length > 0
        )
        
        if (bucketLines.length === 0) {
            console.log("No R2 buckets found. Skipping R2 configuration.")
            return null
        }

        // Parse bucket names (first column)
        const buckets = bucketLines.map(line => {
            const name = line.split(/\s+/)[0]
            return { name }
        })

        // Use the first bucket or look for one with "rin" in the name
        const bucket = buckets.find(b => b.name.toLowerCase().includes('rin')) || buckets[0]
        console.log(`Found R2 bucket: ${bucket.name}`)
        
        // Get account ID from wrangler config
        const accountId = process.env.CF_ACCOUNT_ID
        if (!accountId) {
            console.log("CF_ACCOUNT_ID not set, using default endpoint format")
            return {
                name: bucket.name,
                endpoint: ``,
                accessHost: ``
            }
        }

        return {
            name: bucket.name,
            endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
            accessHost: `https://${bucket.name}.${accountId}.r2.dev`
        }
    } catch (e) {
        console.log("Could not auto-discover R2 bucket:", e)
        return null
    }
}

async function deployServer(): Promise<string | null> {
    console.log("🚀 Deploying backend (Workers)...")
    
    // Get R2 bucket info
    const r2Info = await getR2BucketInfo()
    
    // Use R2 if available and S3 not explicitly configured
    const finalS3Endpoint = S3_ENDPOINT || r2Info?.endpoint || ""
    const finalS3Bucket = S3_BUCKET || r2Info?.name || ""
    const finalS3AccessHost = S3_ACCESS_HOST || r2Info?.accessHost || finalS3Endpoint

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
S3_ENDPOINT = "${finalS3Endpoint}"
S3_ACCESS_HOST = "${finalS3AccessHost}"
S3_BUCKET = "${finalS3Bucket}"
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
    await putSecret('ADMIN_USERNAME', adminUsername)
    await putSecret('ADMIN_PASSWORD', adminPassword)

    console.log(`Put Done.`)
    console.log(`----------------------------`)
    console.log(`Deploying Worker`)
    const { stdout: deployOutput, stderr: deployStderr } = await $`echo -e "n\ny\n" | bunx wrangler deploy`
    
    // Combine stdout and stderr to capture all output
    const fullOutput = deployOutput.toString() + deployStderr.toString()
    
    // Extract worker URL from deploy output
    // Output format: https://worker-name.account.workers.dev
    // Look for the URL in the output (can be in stdout or stderr)
    const urlMatch = fullOutput.match(/https:\/\/[^\s]+\.workers\.dev/)
    const workerUrl = urlMatch ? urlMatch[0] : null
    
    if (workerUrl) {
        console.log(`🌐 Worker URL: ${workerUrl}`)
    } else {
        console.log(`⚠️ Could not extract Worker URL from output`)
        console.log(`Debug - Output preview: ${fullOutput.substring(0, 500)}`)
    }
    
    console.log(`✅ Backend deployed successfully`)
    
    return workerUrl
}

async function deployClient(workerUrl?: string): Promise<string> {
    console.log("🚀 Deploying frontend (Pages)...")
    
    // Get the deployed worker URL
    let apiUrl = workerUrl
    if (!apiUrl) {
        // Fallback: construct URL from worker name
        apiUrl = `https://${WORKER_NAME}.${process.env.CF_ACCOUNT_ID || 'workers'}.dev`
        console.log(`Using API URL: ${apiUrl}`)
    } else {
        console.log(`Using discovered API URL: ${apiUrl}`)
    }

    // Create production env file
    const envContent = `API_URL=${apiUrl}
NAME=${NAME}
DESCRIPTION=${DESCRIPTION}
AVATAR=${AVATAR}
PAGE_SIZE=${PAGE_SIZE}
RSS_ENABLE=${RSS_ENABLE}
`
    await Bun.write('client/.env.production', envContent)
    console.log("Created client/.env.production")

    // Build the client
    console.log("Building client...")
    await $`cd client && bun run build`.quiet()
    console.log("✅ Client built successfully")

    // Deploy to Pages
    console.log("Deploying to Cloudflare Pages...")
    
    // Check if project exists
    const { exitCode: projectExitCode } = await $`bunx wrangler pages project list --json`.quiet().nothrow()
    let projectExists = false
    
    if (projectExitCode === 0) {
        try {
            const { stdout } = await $`bunx wrangler pages project list --json`.quiet()
            const projects = JSON.parse(stdout.toString())
            projectExists = projects.some((p: any) => p.name === PAGES_NAME)
        } catch (e) {
            console.log("Could not check if Pages project exists")
        }
    }

    if (!projectExists) {
        console.log(`Creating Pages project: ${PAGES_NAME}`)
        await $`bunx wrangler pages project create ${PAGES_NAME} --production-branch=main`.quiet().nothrow()
    }

    // Deploy - use appropriate branch based on deployment type
    const isPreview = PAGES_NAME.includes('-pr-') || PAGES_NAME.includes('-trunk')
    const branch = isPreview ? 'preview' : 'main'
    
    try {
        const { stdout: pagesOutput, stderr: pagesStderr } = await $`cd client && bunx wrangler pages deploy dist --project-name=${PAGES_NAME} --branch=${branch}`
        
        // Extract the actual Pages URL from the output
        // Output format: "Take a peek over at https://xxxxx.pages.dev"
        const fullPagesOutput = pagesOutput.toString() + pagesStderr.toString()
        const pagesUrlMatch = fullPagesOutput.match(/https:\/\/[^\s]+\.pages\.dev/)
        const actualPagesUrl = pagesUrlMatch ? pagesUrlMatch[0] : `https://${PAGES_NAME}.pages.dev`
        
        console.log(`✅ Frontend deployed successfully to Pages: ${actualPagesUrl}`)
        
        // Return the actual URL for use in the main function
        return actualPagesUrl
    } catch (e: any) {
        // Check if it's an authentication error
        if (e.stderr?.toString().includes('Authentication error') || e.stderr?.toString().includes('code: 10000')) {
            console.error('\n❌ Authentication failed for Cloudflare Pages deployment.')
            console.error('\nPossible causes:')
            console.error('1. Your API Token does not have "Cloudflare Pages" permission')
            console.error('2. The Pages project does not exist and could not be created')
            console.error('\nTo fix this issue:')
            console.error('1. Go to https://dash.cloudflare.com/profile/api-tokens')
            console.error('2. Create a new token with these permissions:')
            console.error('   - Account: Cloudflare Pages:Edit')
            console.error('   - Account: Workers Scripts:Edit')
            console.error('   - Zone: (your domain):Edit (if using custom domain)')
            console.error('3. Update your CLOUDFLARE_API_TOKEN secret')
            console.error('\nAlternatively, you can manually create the Pages project at:')
            console.error(`https://dash.cloudflare.com/${process.env.CF_ACCOUNT_ID}/pages/new`)
        }
        throw e
    }
}

// Parse wrangler JSON output to extract count value (with --json flag)
function parseWranglerCount(stdout: string): number {
    try {
        const json = JSON.parse(stdout);
        // --json output format: [{ results: [{ count: N }], success: true, meta: {} }]
        if (Array.isArray(json) && json.length > 0 && json[0].results && json[0].results.length > 0) {
            return parseInt(json[0].results[0].count) || 0;
        }
    } catch (e) {
        // Fallback to regex if JSON parsing fails
        const match = stdout.match(/"count":\s*(\d+)/);
        if (match) {
            return parseInt(match[1]) || 0;
        }
    }
    return 0;
}

// Parse wrangler JSON output to extract feed_id values (with --json flag)
function parseWranglerFeedIds(stdout: string): number[] {
    try {
        const json = JSON.parse(stdout);
        // --json output format: [{ results: [{ feed_id: N }, ...], success: true, meta: {} }]
        if (Array.isArray(json) && json.length > 0 && json[0].results) {
            return json[0].results
                .map((row: any) => parseInt(row.feed_id))
                .filter((id: number) => !isNaN(id));
        }
    } catch (e) {
        // Fallback to line parsing if JSON parsing fails
        return stdout
            .split('\n')
            .map(line => line.trim())
            .filter(line => /^\d+$/.test(line))
            .map(id => parseInt(id));
    }
    return [];
}

// Parse wrangler JSON output to extract IP addresses (with --json flag)
function parseWranglerIPs(stdout: string): string[] {
    try {
        const json = JSON.parse(stdout);
        // --json output format: { results: [{ ip: 'x.x.x.x' }, ...], success: true, meta: {} }
        if (json.results) {
            return json.results
                .map((row: any) => row.ip)
                .filter((ip: string) => ip && typeof ip === 'string');
        }
    } catch (e) {
        // Fallback to line parsing if JSON parsing fails
        return stdout
            .split('\n')
            .map(line => line.trim())
            .filter(line => line && !/^\d+$/.test(line) && line !== 'ip');
    }
    return [];
}

// Migrate existing visits data to HyperLogLog format
async function migrateVisitsToHLL(typ: string, dbName: string) {
    console.log(`Checking if HyperLogLog migration is needed...`);
    
    try {
        // Check if visit_stats table has data
        const { stdout: countResult } = await $`bunx wrangler d1 execute ${dbName} --${typ} --json --command="SELECT COUNT(*) as count FROM visit_stats WHERE hll_data != ''"`.quiet();
        const migratedCount = parseWranglerCount(countResult.toString());
        
        if (migratedCount > 0) {
            console.log(`  ${migratedCount} feeds already have HLL data. Migration may already be complete.`);
            return;
        }
        
        // Check if there are visits to migrate
        const { stdout: visitsCount } = await $`bunx wrangler d1 execute ${dbName} --${typ} --json --command="SELECT COUNT(*) as count FROM visits"`.quiet();
        const totalVisits = parseWranglerCount(visitsCount.toString());
        
        if (totalVisits === 0) {
            console.log('  No visits to migrate. Skipping.');
            return;
        }
        
        console.log(`  Found ${totalVisits} visits to migrate to HyperLogLog format.`);
        console.log('  Starting migration...');
        
        // Get all unique feed_ids from visits
        const { stdout: feedIdsResult } = await $`bunx wrangler d1 execute ${dbName} --${typ} --json --command="SELECT DISTINCT feed_id FROM visits"`.quiet();
        const feedIds = parseWranglerFeedIds(feedIdsResult.toString());
        
        console.log(`  Processing ${feedIds.length} feeds...`);
        
        // Process each feed
        let processed = 0;
        for (const feedId of feedIds) {
            try {
                // Get all IPs for this feed
                const { stdout: ipsResult } = await $`bunx wrangler d1 execute ${dbName} --${typ} --json --command="SELECT ip FROM visits WHERE feed_id = ${feedId}"`.quiet();
                const ips = parseWranglerIPs(ipsResult.toString());
                
                if (ips.length === 0) {
                    console.log(`    Feed ${feedId}: No IPs found, skipping`);
                    continue;
                }
                
                console.log(`    Feed ${feedId}: Found ${ips.length} visits`);
                
                // Create HLL and add all IPs
                const hllData = await generateHLLData(ips);
                
                // Calculate UV
                const uv = Math.round(await estimateUV(hllData));
                const pv = ips.length;
                const timestamp = Math.floor(Date.now() / 1000);
                
                console.log(`    Feed ${feedId}: PV=${pv}, UV=${uv}`);
                
                // Escape single quotes in hllData for SQL (though base64 shouldn't have them)
                const escapedHllData = hllData.replace(/'/g, "''");
                
                // Build SQL command - use string concatenation to avoid template literal issues
                const sqlCommand = `INSERT OR REPLACE INTO visit_stats (feed_id, pv, hll_data, updated_at) VALUES (${feedId}, ${pv}, '${escapedHllData}', ${timestamp})`;
                
                // Execute SQL with error handling
                const result = await $`bunx wrangler d1 execute ${dbName} --${typ} --command=${sqlCommand}`.nothrow().quiet();
                
                if (result.exitCode !== 0) {
                    console.error(`    ❌ Failed to insert feed ${feedId}: ${result.stderr}`);
                    console.error(`    SQL: ${sqlCommand.substring(0, 100)}...`);
                    continue;
                }
                
                console.log(`    ✅ Feed ${feedId}: Inserted successfully`);
                processed++;
                
                if (processed % 10 === 0) {
                    console.log(`    Progress: ${processed}/${feedIds.length} feeds processed`);
                }
            } catch (error) {
                console.error(`    ❌ Error processing feed ${feedId}:`, error);
                continue;
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

// Main deployment logic
async function main() {
    const args = process.argv.slice(2)
    const deployTarget = args[0] || 'all'

    console.log("🚀 Starting Rin deployment...")
    console.log(`Target: ${deployTarget}`)
    console.log(``)

    try {
        let workerUrl: string | null = null
        let pagesUrl: string = `https://${PAGES_NAME}.pages.dev`

        if (deployTarget === 'all' || deployTarget === 'server') {
            workerUrl = await deployServer()
        }

        if (deployTarget === 'all' || deployTarget === 'client') {
            // If deploying all, wait for server to be ready and get its URL
            if (deployTarget === 'all') {
                console.log("\n⏳ Waiting for backend to be ready...")
                await new Promise(resolve => setTimeout(resolve, 5000))
            }
            pagesUrl = await deployClient(workerUrl || undefined)
        }

        console.log("\n🎉 Deployment completed successfully!")
        
        if (deployTarget === 'all' || deployTarget === 'client') {
            console.log(`🌐 Frontend: ${pagesUrl}`)
        }
    } catch (error) {
        console.error("\n❌ Deployment failed:", error)
        process.exit(1)
    }
}

main()
