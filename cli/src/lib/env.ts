export function parseEnv(content: string): Record<string, string> {
  const env: Record<string, string> = {};

  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const equalIndex = trimmed.indexOf("=");
    if (equalIndex > 0) {
      env[trimmed.slice(0, equalIndex).trim()] = trimmed.slice(equalIndex + 1).trim();
    }
  }

  return env;
}
