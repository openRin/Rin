import { createInterface } from "node:readline/promises";
import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { logger } from "../lib/logger";
import { maskEnvValue, readEnvFile, unquoteEnvValue, upsertEnvLines } from "../lib/env-file";

type Field = {
  key: string;
  prompt: string;
  /** 机密值：输入不回显 */
  secret?: boolean;
  /** 未配置且直接回车时写入的默认值（机密值不写 fallback） */
  fallback?: string;
  /** 提供候选项时改为选择式提示 */
  options?: string[];
  /** 生成器：未配置直接回车时生成随机值（如 JWT_SECRET） */
  generate?: () => string;
};

type Group = {
  title: string;
  hint?: string;
  /** 返回空数组表示该组按当前配置无需追问 */
  fields: (env: Record<string, string>) => Field[];
};

function randomHex(bytes = 32): string {
  const array = new Uint8Array(bytes);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
}

const GROUPS: Group[] = [
  {
    title: "Core (required)",
    hint: "Site name, JWT secret and the admin login. Password login works without GitHub OAuth.",
    fields: () => [
      { key: "NAME", prompt: "Site name" },
      {
        key: "JWT_SECRET",
        prompt: "JWT secret [Enter = generate random]",
        secret: true,
        generate: () => randomHex(),
      },
      { key: "ADMIN_USERNAME", prompt: "Admin username" },
      { key: "ADMIN_PASSWORD", prompt: "Admin password (input hidden)", secret: true },
      { key: "DB_NAME", prompt: "Local D1 database name", fallback: "rin" },
    ],
  },
  {
    title: "GitHub OAuth (optional)",
    hint: "Required only if you want GitHub login. Password login alone is fine.",
    fields: () => [
      { key: "RIN_GITHUB_CLIENT_ID", prompt: "GitHub client ID" },
      { key: "RIN_GITHUB_CLIENT_SECRET", prompt: "GitHub client secret (input hidden)", secret: true },
    ],
  },
  {
    title: "Turnstile captcha (optional)",
    hint: "Leave ENABLED empty to let the admin backend setting decide.",
    fields: () => [
      { key: "TURNSTILE_ENABLED", prompt: "Turnstile enabled (true / empty)", options: ["true", ""] },
      { key: "TURNSTILE_SITE_KEY", prompt: "Turnstile site key (public)" },
      { key: "TURNSTILE_SECRET_KEY", prompt: "Turnstile secret key (input hidden)", secret: true },
    ],
  },
  {
    title: "Mail (optional)",
    hint: "Provider for verification codes and notifications. Empty skips mail features.",
    fields: (env) => {
      const provider = env.MAIL_PROVIDER ?? "";
      const base: Field[] = [
        { key: "MAIL_PROVIDER", prompt: "Mail provider (smtp / resend / gateway / empty)", options: ["smtp", "resend", "gateway", ""] },
        { key: "MAIL_FROM", prompt: "From address (e.g. blog@example.com)" },
      ];
      if (provider === "smtp") {
        base.push(
          { key: "SMTP_HOST", prompt: "SMTP host" },
          { key: "SMTP_PORT", prompt: "SMTP port", fallback: "465" },
          { key: "SMTP_USERNAME", prompt: "SMTP username" },
          { key: "SMTP_PASSWORD", prompt: "SMTP password (input hidden)", secret: true },
        );
      } else if (provider === "resend") {
        base.push({ key: "RESEND_API_KEY", prompt: "Resend API key (input hidden)", secret: true });
      } else if (provider === "gateway") {
        base.push(
          { key: "MAIL_GATEWAY_ENDPOINT", prompt: "Mail gateway endpoint" },
          { key: "MAIL_GATEWAY_TOKEN", prompt: "Mail gateway token (input hidden)", secret: true },
        );
      }
      return base;
    },
  },
  {
    title: "Object storage (optional)",
    hint: "Images and cache. Empty provider auto-detects from the values below.",
    fields: (env) => {
      const provider = env.STORAGE_PROVIDER ?? "";
      const base: Field[] = [
        { key: "STORAGE_PROVIDER", prompt: "Storage provider (r2 / s3 / supabase / empty=auto)", options: ["r2", "s3", "supabase", ""] },
      ];
      if (provider === "s3") {
        base.push(
          { key: "S3_ENDPOINT", prompt: "S3 endpoint" },
          { key: "S3_BUCKET", prompt: "S3 bucket" },
          { key: "S3_ACCESS_KEY_ID", prompt: "S3 access key ID (input hidden)", secret: true },
          { key: "S3_SECRET_ACCESS_KEY", prompt: "S3 secret access key (input hidden)", secret: true },
          { key: "S3_ACCESS_HOST", prompt: "S3 public access host (empty = endpoint)" },
        );
      } else if (provider === "supabase") {
        base.push(
          { key: "SUPABASE_URL", prompt: "Supabase project URL" },
          { key: "SUPABASE_SECRET_KEY", prompt: "Supabase secret key (input hidden)", secret: true },
          { key: "SUPABASE_STORAGE_BUCKET", prompt: "Supabase storage bucket" },
          { key: "SUPABASE_STORAGE_PUBLIC", prompt: "Public bucket, serve via CDN (true / false)", options: ["true", "false"] },
        );
      }
      return base;
    },
  },
  {
    title: "Publish CLI (optional)",
    hint: "Where 'rin publish' sends posts.",
    fields: () => [{ key: "RIN_PUBLISH_API", prompt: "Blog API base URL (e.g. https://blog.example.com/api)" }],
  },
];

const ALL_FIELDS: Field[] = GROUPS.flatMap((g) => g.fields({}));

const envPath = path.resolve(process.cwd(), ".env.local");

function ask(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return rl.question(question).finally(() => rl.close());
}

/** 机密值输入：raw 模式逐字符读取，回显 *，Enter 结束 */
function askHidden(question: string): Promise<string> {
  return new Promise((resolve) => {
    process.stdout.write(question);
    const stdin = process.stdin;
    const wasRaw = stdin.isRaw;
    if (stdin.isTTY) stdin.setRawMode(true);
    stdin.resume();

    let value = "";
    const onChar = (chunk: Buffer) => {
      for (const ch of chunk.toString()) {
        if (ch === "\r" || ch === "\n") {
          stdin.setRawMode?.(wasRaw ?? false);
          stdin.removeListener("data", onChar);
          stdin.pause();
          process.stdout.write("\n");
          resolve(value);
          return;
        }
        if (ch === "\x7f" || ch === "\b") {
          value = value.slice(0, -1);
          process.stdout.write("\b \b");
          continue;
        }
        if (ch < " ") continue;
        value += ch;
        process.stdout.write("*");
      }
    };
    stdin.on("data", onChar);
  });
}

async function askField(field: Field, existing: string): Promise<string> {
  const shown = field.secret ? maskEnvValue(existing) : existing || (field.fallback ? `(${field.fallback})` : "");
  const question = `${field.prompt} [${shown}]: `;

  if (field.options) {
    const opts = field.options.filter(Boolean).join(" / ") || "empty";
    const answer = (await ask(`${question} (${opts}) `)).trim();
    return answer;
  }

  const answer = field.secret ? await askHidden(question) : (await ask(question)).trim();
  return answer;
}

function printHelp() {
  console.log(`Configure deployment environment variables in .env.local (repo root).

Usage:
  rin config              # interactive walkthrough, group by group; Enter keeps current value
  rin config --list       # show current values (secrets masked)

Groups: ${GROUPS.map((g) => g.title).join(" | ")}`);
}

export async function runConfigCommand(args: string[]) {
  const { values } = parseArgs({
    args,
    options: {
      list: { type: "boolean", default: false },
      help: { type: "boolean", short: "h", default: false },
    },
  });

  if (values.help) {
    printHelp();
    return;
  }

  const current = readEnvFile(envPath);

  if (values.list) {
    for (const field of ALL_FIELDS) {
      const raw = unquoteEnvValue(current[field.key]);
      console.log(`${field.key}=${field.secret ? maskEnvValue(raw) : raw || "(not set)"}`);
    }
    return;
  }

  if (!process.stdin.isTTY) {
    logger.error("rin config needs an interactive terminal. Use 'rin config --list' to inspect values.");
    return;
  }

  console.log(`Configuring ${envPath}
Press Enter to keep the current value; enter "-" to clear a value.\n`);

  const next: Record<string, string> = {};
  for (const group of GROUPS) {
    const fields = group.fields(current);
    if (fields.length === 0) continue;

    console.log(`\n── ${group.title} ──`);
    if (group.hint) console.log(`   ${group.hint}`);

    for (const field of fields) {
      const existing = unquoteEnvValue(current[field.key]);
      const answer = await askField(field, existing);

      if (answer === "-") continue; // 清除：不写入
      if (answer === "") {
        if (existing) next[field.key] = existing;
        else if (field.generate) next[field.key] = field.generate();
        else if (field.fallback && !field.secret) next[field.key] = field.fallback;
        continue;
      }
      next[field.key] = answer;
    }
  }

  const before = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";
  const edit = upsertEnvLines(before, next);

  if (edit.updated.length === 0 && edit.appended.length === 0) {
    console.log("\nNo changes.");
    return;
  }

  fs.writeFileSync(envPath, edit.content, "utf8");
  if (edit.updated.length > 0) console.log(`\nUpdated: ${edit.updated.join(", ")}`);
  if (edit.appended.length > 0) console.log(`Added: ${edit.appended.join(", ")}`);
  console.log(`Saved to ${envPath}`);
}
