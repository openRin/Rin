import { drizzle } from "drizzle-orm/d1";
import * as schema from "../db/schema";
import { buildClientConfigResponse } from "../services/config-helpers";
import { CacheImpl } from "../utils/cache";

const CLIENT_CONFIG_SCRIPT_MARKER = "__RIN_CLIENT_CONFIG__";
const CLIENT_CONFIG_SCRIPT_ID = "rin-client-config";

function escapeScriptContent(value: string) {
  return value
    .replace(/</g, "\\u003C")
    .replace(/>/g, "\\u003E")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

function buildClientConfigScript(config: Record<string, unknown>) {
  const serialized = escapeScriptContent(JSON.stringify(config));
  return `<script id="${CLIENT_CONFIG_SCRIPT_ID}">window.${CLIENT_CONFIG_SCRIPT_MARKER}=${serialized};</script>`;
}

export function inlineClientConfigHtml(html: string, config: Record<string, unknown>) {
  const script = buildClientConfigScript(config);
  return html.includes("</head>")
    ? html.replace("</head>", `${script}</head>`)
    : `${script}${html}`;
}

export async function buildInlineClientConfig(env: Env) {
  const db = drizzle(env.DB, { schema });
  const clientConfig = new CacheImpl(db, env, "client.config");
  return buildClientConfigResponse(db, clientConfig, env);
}

export async function injectClientConfigIntoHtml(response: Response, env: Env) {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) {
    return response;
  }

  const clientConfig = await buildInlineClientConfig(env);
  const html = await response.text();
  const nextHtml = inlineClientConfigHtml(html, clientConfig);
  const headers = new Headers(response.headers);
  headers.set("content-length", String(new TextEncoder().encode(nextHtml).byteLength));

  return new Response(nextHtml, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
