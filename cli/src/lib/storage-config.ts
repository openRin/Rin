/**
 * 部署期对象存储配置解析，供 deploy-cf 与 setup-dev 共用。
 * 只做「哪个后端 + 需要哪些变量」的判定，运行时选择在 server/src/utils/storage/resolve.ts。
 */

export type StorageProviderKind = "r2" | "s3" | "supabase";

export const STORAGE_PROVIDER_KINDS: StorageProviderKind[] = ["r2", "s3", "supabase"];

export type EnvRecord = Record<string, string | undefined>;

export interface ResolvedStorageConfig {
  /** 实际生效的后端 */
  provider: StorageProviderKind;
  /** wrangler.toml [vars] 需要写入的键值 */
  vars: Record<string, string>;
  /** 必填但缺失的变量名（用于报错提示） */
  missing: string[];
  /** 需要写入 Worker Secret / .dev.vars 的键值 */
  secrets: Record<string, string>;
}

/** 解析后端，优先级与运行时一致：显式 STORAGE_PROVIDER > Supabase 探测 > R2_BUCKET_NAME > s3 */
export function resolveStorageConfig(env: EnvRecord): ResolvedStorageConfig {
  const provider = resolveProvider(env);

  const vars: Record<string, string> = {
    STORAGE_PROVIDER: provider,
  };
  const secrets: Record<string, string> = {};

  if (provider === "supabase") {
    vars.SUPABASE_URL = env.SUPABASE_URL || "";
    vars.SUPABASE_STORAGE_BUCKET = env.SUPABASE_STORAGE_BUCKET || "";
    vars.SUPABASE_STORAGE_PUBLIC = env.SUPABASE_STORAGE_PUBLIC || "false";

    // 兼容旧变量名：旧名填入时同步到新名，保证 wrangler.toml 只需一个键
    const secretKey = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
    if (secretKey) {
      secrets.SUPABASE_SECRET_KEY = secretKey;
    }

    // Supabase 模式下同样保留 S3_* 的公共配置（folder 前缀）
    vars.S3_FOLDER = env.S3_FOLDER || "images/";
    vars.S3_CACHE_FOLDER = env.S3_CACHE_FOLDER || "cache/";

    return {
      provider,
      vars,
      secrets,
      missing: [
        !env.SUPABASE_URL && "SUPABASE_URL",
        !secretKey && "SUPABASE_SECRET_KEY",
        !env.SUPABASE_STORAGE_BUCKET && "SUPABASE_STORAGE_BUCKET",
      ].filter((name): name is string => Boolean(name)),
    };
  }

  vars.S3_FOLDER = env.S3_FOLDER || "images/";
  vars.S3_CACHE_FOLDER = env.S3_CACHE_FOLDER || "cache/";
  vars.S3_REGION = env.S3_REGION || "auto";
  vars.S3_ENDPOINT = env.S3_ENDPOINT || "";
  vars.S3_ACCESS_HOST = env.S3_ACCESS_HOST || "";
  vars.S3_BUCKET = env.S3_BUCKET || "";
  vars.S3_FORCE_PATH_STYLE = env.S3_FORCE_PATH_STYLE || "false";

  if (env.S3_ACCESS_KEY_ID) {
    secrets.S3_ACCESS_KEY_ID = env.S3_ACCESS_KEY_ID;
  }
  if (env.S3_SECRET_ACCESS_KEY) {
    secrets.S3_SECRET_ACCESS_KEY = env.S3_SECRET_ACCESS_KEY;
  }

  // R2 binding 自带凭证，无需 S3 key
  if (provider === "r2") {
    return { provider, vars, secrets, missing: [] };
  }

  return {
    provider,
    vars,
    secrets,
    missing: [
      !env.S3_ENDPOINT && "S3_ENDPOINT",
      !env.S3_BUCKET && "S3_BUCKET",
      !env.S3_ACCESS_KEY_ID && "S3_ACCESS_KEY_ID",
      !env.S3_SECRET_ACCESS_KEY && "S3_SECRET_ACCESS_KEY",
    ].filter((name): name is string => Boolean(name)),
  };
}

/** 把变量渲染成 wrangler.toml 的 `KEY = "value"` 行；缺值写空串 */
export function buildStorageVarsToml(
  vars: Record<string, string | undefined>,
  indent = "",
) {
  return Object.entries(vars)
    .map(([key, value]) => `${indent}${key} = "${value ?? ""}"`)
    .join("\n");
}

function resolveProvider(env: EnvRecord): StorageProviderKind {
  const explicit = env.STORAGE_PROVIDER?.trim().toLowerCase();
  if (explicit) {
    if (STORAGE_PROVIDER_KINDS.includes(explicit as StorageProviderKind)) {
      return explicit as StorageProviderKind;
    }
    throw new Error(
      `STORAGE_PROVIDER "${env.STORAGE_PROVIDER}" is not supported, expected ${STORAGE_PROVIDER_KINDS.join(", ")}`,
    );
  }

  if (env.SUPABASE_URL && env.SUPABASE_STORAGE_BUCKET) {
    return "supabase";
  }

  return env.R2_BUCKET_NAME ? "r2" : "s3";
}