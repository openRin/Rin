import fs from "node:fs";
import { parseEnv } from "./env";

export type EnvFileEdit = {
  content: string;
  updated: string[];
  appended: string[];
};

/**
 * 在 .env 文本中更新给定键值：已有键原位替换，缺失键追加到末尾，
 * 注释、空行与键的顺序保持不变。值不支持换行（.env 本就一行一键）。
 */
export function upsertEnvLines(content: string, values: Record<string, string>): EnvFileEdit {
  const updated: string[] = [];
  const appended: string[] = [];
  const pending = new Map(Object.entries(values));
  const eol = content.includes("\r\n") ? "\r\n" : "\n";
  const lines = content.length === 0 ? [] : content.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trim();
    const equalIndex = trimmed.indexOf("=");
    const key = equalIndex > 0 ? trimmed.slice(0, equalIndex).trim() : null;

    if (key === null || !pending.has(key)) continue;

    const value = pending.get(key);
    pending.delete(key);
    if (trimmed.slice(equalIndex + 1).trim() === value) continue;

    const inlineComment = trimmed.slice(trimmed.indexOf("=")).match(/\s+#.*$/)?.[0] ?? "";
    lines[i] = `${key}=${value}${inlineComment}`;
    updated.push(key);
  }

  if (pending.size > 0) {
    while (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
    for (const [key, value] of pending) {
      lines.push(`${key}=${value}`);
      appended.push(key);
    }
  }

  return { content: lines.join(eol) + (lines.length > 0 ? eol : ""), updated, appended };
}

/** 去掉 parseEnv 值上可能残留的成对引号 */
export function unquoteEnvValue(value: string | undefined): string {
  if (value === undefined) return "";
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
}

/** 展示用打码：非空值只保留前 2 个字符 */
export function maskEnvValue(value: string | undefined): string {
  if (!value) return "(not set)";
  return value.length <= 2 ? "*".repeat(value.length) : value.slice(0, 2) + "*".repeat(Math.max(value.length - 2, 3));
}

export function readEnvFile(envPath: string): Record<string, string> {
  if (!fs.existsSync(envPath)) return {};
  return parseEnv(fs.readFileSync(envPath, "utf8"));
}
