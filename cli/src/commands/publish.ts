import * as fs from "node:fs";
import * as path from "node:path";
import { parseArgs } from "node:util";
import { logger } from "../lib/logger";
import { parseEnv } from "../lib/env";

/**
 * 向线上博客发布文章，走 `/api/feed-write` 接口（dryRun 友好）。
 * 凭证从 .env.local 读取，不接受命令行传密码；API 地址优先级：--api > RIN_PUBLISH_API。
 *
 * 用法：bun run publish <payload.json> [--real] [--id 12]
 */

interface PublishPayload {
  title: string;
  content: string;
  summary?: string;
  alias?: string;
  draft?: boolean;
  listed?: boolean;
  tags?: string[];
  dryRun?: boolean;
}

/** API 地址：--api > .env.local 的 RIN_PUBLISH_API */
function resolveApiBase(explicit?: string): string {
  if (explicit) {
    return explicit;
  }

  const envPath = path.resolve(process.cwd(), ".env.local");
  const fromEnv = fs.existsSync(envPath)
    ? parseEnv(fs.readFileSync(envPath, "utf-8")).RIN_PUBLISH_API
    : undefined;
  if (!fromEnv) {
    throw new Error("API base URL is required: pass --api <url> or set RIN_PUBLISH_API in .env.local");
  }
  return fromEnv;
}

/** 读取 .env.local 里的凭证 */
function readCredentials(): { username: string; password: string } {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) {
    throw new Error(
      `${envPath} not found. Run "bun run dev:setup" or create it with ADMIN_USERNAME and ADMIN_PASSWORD`,
    );
  }

  const env = parseEnv(fs.readFileSync(envPath, "utf-8"));
  const username = env.ADMIN_USERNAME;
  const password = env.ADMIN_PASSWORD;

  if (!username || !password) {
    throw new Error(`${envPath} is missing ADMIN_USERNAME or ADMIN_PASSWORD`);
  }

  return { username, password };
}

async function login(apiBase: string, username: string, password: string): Promise<string> {
  const res = await fetch(`${apiBase}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });

  if (!res.ok) {
    throw new Error(`Login failed (HTTP ${res.status}). Check credentials in .env.local`);
  }

  const body = (await res.json()) as { success: boolean; token?: string; error?: { message: string } };
  if (!body.success || !body.token) {
    throw new Error(`Login failed: ${body.error?.message ?? "unknown error"}`);
  }

  return body.token;
}

interface PublishResult {
  success: boolean;
  data?: Record<string, unknown>;
  error?: { code: string; message: string };
}

async function publish(
  apiBase: string,
  token: string,
  payload: PublishPayload,
  id?: number,
): Promise<PublishResult> {
  const endpoint = id ? `${apiBase}/feed-write/${id}` : `${apiBase}/feed-write`;
  const res = await fetch(endpoint, {
    method: id ? "PUT" : "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  return (await res.json()) as PublishResult;
}

export async function runPublishCommand(rawArgs: string[]) {
  const { values, positionals } = parseArgs({
    args: rawArgs,
    allowPositionals: true,
    options: {
      real: { type: "boolean", default: false },
      id: { type: "string" },
      api: { type: "string" },
      help: { type: "boolean", short: "h", default: false },
    },
  });

  if (values.help) {
    console.log(`Publish an article to the live blog

Usage:
  rin publish <payload.json>              # dryRun validation (default, no writes)
  rin publish <payload.json> --real       # publish for real
  rin publish <payload.json> --id 12      # update article id=12
  rin publish <payload.json> --api <url>  # override API base URL

(inside the project directory, "bun run publish" works the same)

payload.json fields:
  title    required, article title
  content  required, Markdown body (no front matter, no H1)
  summary  optional summary
  alias    custom path, served at /post/<alias>
  draft    whether it is a draft
  listed   whether it appears on the home page list
  tags     array of tags

Credentials are read from ADMIN_USERNAME / ADMIN_PASSWORD in .env.local.
API base URL: --api flag, or RIN_PUBLISH_API in .env.local.`);
    return;
  }

  const file = positionals[0];
  if (!file) {
    logger.error("Payload file is required");
    console.log("Usage: rin publish <payload.json> [--real] [--id <articleId>]");
    throw new Error("Payload file is required");
  }

  const payloadPath = path.resolve(process.cwd(), file);
  if (!fs.existsSync(payloadPath)) {
    throw new Error(`File not found: ${payloadPath}`);
  }

  const payload = JSON.parse(fs.readFileSync(payloadPath, "utf-8")) as PublishPayload;

  // 基本校验：早点报错比让服务端返回 400 更快
  if (!payload.title?.trim()) {
    throw new Error('payload is missing "title"');
  }
  if (!payload.content?.trim()) {
    throw new Error('payload is missing "content"');
  }
  if (payload.content.includes("\n---\n") || payload.content.startsWith("---")) {
    logger.warn("content looks like it has front matter — pass title/summary/tags as fields, body should be Markdown only");
  }
  if (/^#\s+/m.test(payload.content.split("\n")[0] ?? "")) {
    logger.warn("content starts with an H1 — title is already a separate field, the body does not need an H1");
  }

  const apiBase = resolveApiBase(values.api);
  const { username, password } = readCredentials();
  const token = await login(apiBase, username, password);

  // dryRun 时补上标记，不改动用户的 payload 文件
  const requestPayload: PublishPayload = values.real
    ? { ...payload }
    : { ...payload, dryRun: true };

  // --id 传进来是 string，这里转成 number；非数字视为未指定
  const targetId = values.id?.trim() ? Number(values.id.trim()) : undefined;
  if (targetId !== undefined && !Number.isFinite(targetId)) {
    throw new Error(`--id 需要是数字，收到 "${values.id}"`);
  }

  const result = await publish(apiBase, token, requestPayload, targetId);

  if (!result.success) {
    logger.error(`Publish failed: ${result.error?.code} ${result.error?.message ?? ""}`);
    throw new Error(result.error?.message ?? "Publish failed");
  }

  const data = result.data ?? {};
  console.log("");
  console.log(`✅ ${values.real ? (values.id ? "Updated" : "Published") : "dryRun verified"}`);
  if (data.id !== undefined) console.log(`   id: ${data.id}`);
  if (data.url) console.log(`   URL: ${apiBase.replace("/api", "")}${data.url}`);
  if (data.dryRun) {
    console.log("");
    console.log("   This is a dryRun result, nothing was written. Add --real to publish.");
  }
}
