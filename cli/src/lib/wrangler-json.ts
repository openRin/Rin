/**
 * 解析 wrangler `--json` 的输出。
 * wrangler 会在 JSON 前插入非 JSON 提示行（如代理检测提示），这里从第一个 [ 或 { 截取。
 */
export function parseWranglerJson(stdout: string): any {
  const trimmed = stdout.trim();
  const arrayStart = trimmed.indexOf("[");
  const objectStart = trimmed.indexOf("{");

  if (arrayStart === -1 && objectStart === -1) {
    throw new Error(`wrangler returned no JSON: ${trimmed.slice(0, 200)}`);
  }

  // 取更早出现的那个，保证截到完整的 JSON 文档
  const start =
    arrayStart === -1
      ? objectStart
      : objectStart === -1
        ? arrayStart
        : Math.min(arrayStart, objectStart);

  return JSON.parse(trimmed.slice(start));
}
