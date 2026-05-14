import { existsSync } from "node:fs";
import { join } from "node:path";

export function projectPath(...segments: string[]) {
  return join(process.cwd(), ...segments);
}

export function ensureProjectFile(...segments: string[]) {
  const file = projectPath(...segments);
  if (!existsSync(file)) {
    throw new Error(`Required file not found: ${file}`);
  }
  return file;
}
