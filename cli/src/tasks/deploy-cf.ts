import { $ } from "bun";
import { readdir, unlink } from "node:fs/promises";
import stripIndent from "strip-indent";
import {
  fixTopField,
  getMigrationFileVersion,
  getMigrationVersion,
  updateMigrationVersion,
} from "../lib/db-migration";
import { buildStorageVarsToml, resolveStorageConfig } from "../lib/storage-config";
import { parseWranglerJson } from "../lib/wrangler-json";
const bunExec = process.execPath;

function env(name: string, defaultValue?: string, required = false) {
  const value = process.env[name] || defaultValue;
  if (required && !value) {
    throw new Error(`${name} is not defined`);
  }
  return value;
}

const renv = (name: string, defaultValue?: string) => env(name, defaultValue, true)!;

const WORKER_SECRET_KEYS = [
  "JWT_SECRET",
  "ADMIN_USERNAME",
  "ADMIN_PASSWORD",
  "RIN_GITHUB_CLIENT_ID",
  "RIN_GITHUB_CLIENT_SECRET",
  "S3_ACCESS_KEY_ID",
  "S3_SECRET_ACCESS_KEY",
  "SUPABASE_SECRET_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  // 人机验证：secret 必须走 secret，site key 是公开值可走 vars
  "TURNSTILE_SECRET_KEY",
  // 邮件相关凭证
  "SMTP_PASSWORD",
  "RESEND_API_KEY",
  "MAIL_GATEWAY_TOKEN",
  "MAIL_JWT_SECRET",
] as const;

/**
 * 公开配置，走 wrangler vars 而非 secret。
 * 这些值要么本来就公开（site key），要么只是路由信息（host / endpoint）。
 */
const WORKER_PUBLIC_VAR_KEYS = [
  "TURNSTILE_SITE_KEY",
  "TURNSTILE_ENABLED",
  "MAIL_PROVIDER",
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_USERNAME",
  "SMTP_FROM",
  "RESEND_ENDPOINT",
  "MAIL_GATEWAY_ENDPOINT",
  "MAIL_GATEWAY_AUTH_HEADER",
  "MAIL_GATEWAY_AUTH_TEMPLATE",
  "MAIL_FROM",
  "MAIL_TIMEOUT_MS",
] as const;

function isQueueAlreadyPresentError(stderr: string) {
  return stderr.includes("already exists") || stderr.includes("already taken") || stderr.includes("[code: 11009]");
}

export function collectWorkerSecrets(source: Record<string, string | undefined> = process.env) {
  const secrets: Record<string, string> = {};

  for (const key of WORKER_SECRET_KEYS) {
    const value = source[key];
    if (value && value.length > 0) {
      secrets[key] = value;
    }
  }

  return secrets;
}

/**
 * 收集公开配置（Turnstile site key、SMTP 连接信息）。
 * 这些值会随 wrangler vars 写进部署配置，不是机密。
 */
export function collectWorkerPublicVars(source: Record<string, string | undefined> = process.env) {
  const vars: Record<string, string> = {};

  for (const key of WORKER_PUBLIC_VAR_KEYS) {
    const value = source[key];
    if (value && value.length > 0) {
      vars[key] = value;
    }
  }

  return vars;
}

async function syncWorkerSecrets(workerName: string) {
  const secrets = collectWorkerSecrets();
  const secretKeys = Object.keys(secrets);

  if (secretKeys.length === 0) {
    console.log("ℹ️ No worker secrets provided; skipping secret sync");
    return;
  }

  const tempFile = ".wrangler-secrets.json";
  await Bun.write(tempFile, JSON.stringify(secrets, null, 2));

  try {
    await $`${bunExec} x wrangler secret bulk ${tempFile} --name ${workerName}`;
    console.log(`✅ Synced ${secretKeys.length} worker secret(s)`);
  } finally {
    await unlink(tempFile).catch(() => {});
  }
}

async function buildClient() {
  const distIndex = Bun.file("./dist/client/index.html");
  if (await distIndex.exists()) {
    console.log("✅ Using pre-built client from ./dist/client");
    return;
  }

  console.log("🔨 Building client...");
  await $`cd client && ${bunExec} run build`.quiet();
  console.log("✅ Client built successfully");
}

type R2BucketInfo = {
  name: string;
  endpoint: string;
  accessHost: string;
};

export function buildR2BucketInfo(r2BucketName: string, accountId: string): R2BucketInfo {
  return {
    name: r2BucketName,
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    accessHost: `https://${r2BucketName}.${accountId}.r2.dev`,
  };
}

export function buildWranglerTriggersConfig(preview = false) {
  return preview
    ? ""
    : stripIndent(`
        [triggers]
        crons = ["*/20 * * * *"]
      `);
}

export function buildWranglerQueueConfig(taskQueueName: string, preview = false) {
  return stripIndent(`
    [[queues.producers]]
    binding = "TASK_QUEUE"
    queue = "${taskQueueName}"

    [[queues.consumers]]
    queue = "${taskQueueName}"
    max_batch_size = 1
    max_batch_timeout = 5
  `);
}

export function buildWranglerObservabilityConfig(preview = false) {
  if (!preview) {
    return "";
  }

  return stripIndent(`
    [observability]

    [observability.logs]
    enabled = true
    invocation_logs = true

    [observability.traces]
    enabled = false
  `);
}

async function resolveR2BucketInfo(r2BucketName: string) {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  if (!accountId) return null;
  if (!r2BucketName) {
    return null;
  }
  return buildR2BucketInfo(r2BucketName, accountId);
}

export async function runCloudflareDeploy(target: "all" | "server" | "client" = "all", preview = false) {
  if (target === "client") {
    await buildClient();
    await $`${bunExec} x wrangler pages deploy dist/client`;
    return;
  }

  const dbName = renv("DB_NAME", "rin");
  const workerName = renv("WORKER_NAME", "rin-server");
  const taskQueueName = env("TASK_QUEUE_NAME", env("AI_SUMMARY_QUEUE_NAME", `${workerName}-tasks`)) ?? `${workerName}-tasks`;
  const r2BucketName = env("R2_BUCKET_NAME", "");
  const storageConfig = resolveStorageConfig(process.env);
  const webhookUrl = env("WEBHOOK_URL", "");
  const rssTitle = env("RSS_TITLE", "");
  const rssDescription = env("RSS_DESCRIPTION", "");
  const cacheStorageMode = env("CACHE_STORAGE_MODE", "s3");
  const name = env("NAME", "Rin");
  const description = env("DESCRIPTION", "A lightweight personal blogging system");
  const avatar = env("AVATAR", "");
  const pageSize = env("PAGE_SIZE", "5");
  const rssEnable = env("RSS_ENABLE", "false");
  const frontendUrl = env("FRONTEND_URL", "");

  // Supabase 后端不需要 R2 binding，也不从 R2 推导 S3_* 参数
  if (storageConfig.provider === "s3") {
    if (!storageConfig.vars.S3_ENDPOINT || !storageConfig.vars.S3_BUCKET) {
      const r2Info = await resolveR2BucketInfo(r2BucketName || "");
      if (r2Info) {
        storageConfig.vars.S3_ENDPOINT ||= r2Info.endpoint;
        storageConfig.vars.S3_BUCKET ||= r2Info.name;
      }
    }
  }

  if (target !== "server") {
    await buildClient();
  }

  const serverDistIndex = Bun.file("./dist/server/_worker.js");
  const hasServerBuild = await serverDistIndex.exists();
  const serverMain = hasServerBuild ? "dist/server/_worker.js" : "server/src/_worker.ts";

  // [vars] 段单独拼装后追加，不放进 stripIndent 模板。
  // 原因：插值出来的行是零缩进，会让 stripIndent 算出的最小缩进变成 0，
  // 结果整个模板（包括 main）都不去缩进，TOML 表结构错乱，
  // wrangler 报 "Missing entry-point to Worker script"。
  const publicVars = collectWorkerPublicVars();

  const varsToml = buildStorageVarsToml({
    ...storageConfig.vars,
    WEBHOOK_URL: webhookUrl,
    RSS_TITLE: rssTitle,
    RSS_DESCRIPTION: rssDescription,
    CACHE_STORAGE_MODE: cacheStorageMode,
    NAME: name,
    DESCRIPTION: description,
    AVATAR: avatar,
    PAGE_SIZE: pageSize,
    RSS_ENABLE: rssEnable,
    FRONTEND_URL: frontendUrl,
    // 人机验证与邮箱注册的公开配置。
    // 未配置时键值不存在，服务端会自动把对应功能判定为关闭。
    ...publicVars,
  });
  Bun.write(
    "wrangler.toml",
    [
      stripIndent(`
        #:schema node_modules/wrangler/config-schema.json
        name = "${workerName}"
        main = "${serverMain}"
        compatibility_date = "2026-01-20"

        [assets]
        directory = "./dist/client"
        binding = "ASSETS"
        ${buildWranglerTriggersConfig(preview)}
        ${buildWranglerObservabilityConfig(preview)}

        [placement]
        mode = "smart"
      `),
      "",
      "[vars]",
      varsToml,
      "",
    ].join("\n"),
  );

  const { exitCode, stderr, stdout } = await $`${bunExec} x wrangler d1 create ${dbName}`.quiet().nothrow();
  if (exitCode !== 0 && !stderr.toString().includes("already exists")) {
    console.error(`Failed to create D1 "${dbName}"`);
    console.error(stripIndent(stdout.toString()));
    console.error(stripIndent(stderr.toString()));
    process.exit(1);
  }

  const queueCreate = await $`${bunExec} x wrangler queues create ${taskQueueName}`.quiet().nothrow();
  if (queueCreate.exitCode !== 0 && !isQueueAlreadyPresentError(queueCreate.stderr.toString())) {
    console.error(`Failed to create Queue "${taskQueueName}"`);
    console.error(stripIndent(queueCreate.stdout.toString()));
    console.error(stripIndent(queueCreate.stderr.toString()));
    process.exit(1);
  }

  const d1List = parseWranglerJson(
    await $`${bunExec} x wrangler d1 list --json`.quiet().text(),
  ) as Array<{ name: string; uuid: string }>;

  const listJson = d1List.find((item) => item.name === dbName);

  if (!listJson) {
    // 写不出真实 uuid 时，wrangler 会沿用 setup-dev 留下的 database_id = "local"，
    // 部署阶段必然报 "must have a valid database_id"。这里提前给出明确原因。
    const available = d1List.map((item) => item.name).join(", ");
    console.error(`Failed to resolve D1 database "${dbName}" on this Cloudflare account.`);
    console.error(
      available
        ? `Available databases: ${available}. Set DB_NAME to one of them, or create it with: wrangler d1 create ${dbName}`
        : `No D1 databases found. Check CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID, or create it with: wrangler d1 create ${dbName}`,
    );
    process.exit(1);
  }

  await $`echo ${stripIndent(`
      [[d1_databases]]
      binding = "DB"
      database_name = "${listJson.name}"
      database_id = "${listJson.uuid}"
    `)} >> wrangler.toml`.quiet();

  await $`echo ${stripIndent(`
    [ai]
    binding = "AI"
  `)} >> wrangler.toml`.quiet();

  await $`echo ${buildWranglerQueueConfig(taskQueueName, preview)} >> wrangler.toml`.quiet();

  if (r2BucketName && storageConfig.provider !== "supabase") {
    await $`echo ${stripIndent(`
      [[r2_buckets]]
      binding = "R2_BUCKET"
      bucket_name = "${r2BucketName}"
      preview_bucket_name = "${r2BucketName}"
    `)} >> wrangler.toml`.quiet();
  }

  const migrationVersion = await getMigrationVersion("remote", dbName);
  // Migration 0011 indexes feeds.top, so repair the column before pending SQL runs.
  await fixTopField("remote", dbName);
  const files = await readdir("./server/sql", { recursive: false });
  const sqlFiles = files
    .filter((name) => name.endsWith(".sql"))
    .filter((name) => {
      const version = getMigrationFileVersion(name);
      return version !== null && version > migrationVersion;
    })
    .sort((left, right) => {
      return (getMigrationFileVersion(left) || 0) - (getMigrationFileVersion(right) || 0);
    });

  for (const file of sqlFiles) {
    await $`${bunExec} x wrangler d1 execute ${dbName} --remote --file ./server/sql/${file} -y`;
    console.log(`Migrated ${file}`);
  }
  if (sqlFiles.length > 0) {
    const lastVersion = getMigrationFileVersion(sqlFiles[sqlFiles.length - 1] || "");
    if (lastVersion !== null) {
      await updateMigrationVersion("remote", dbName, lastVersion);
    }
  }
  if (target === "server") {
    await $`${bunExec} x wrangler deploy`;
    await syncWorkerSecrets(workerName);
    return;
  }

  await $`${bunExec} x wrangler deploy`;
  await syncWorkerSecrets(workerName);
}
