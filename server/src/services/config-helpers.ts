import {
  AI_CONFIG_KEYS,
  CLIENT_CONFIG_ENV_DEFAULTS,
  SENSITIVE_SERVER_CONFIG_FIELDS,
} from "@rin/config";
import { getAIConfigForFrontend } from "../utils/db-config";

type ConfigMapLike = {
  all(): Promise<Map<string, unknown>>;
  set(key: string, value: unknown, save?: boolean): Promise<void>;
  save(): Promise<void>;
};

export type ConfigTypeParam = "client" | "server";

export function isConfigType(type: string): type is ConfigTypeParam {
  return type === "client" || type === "server";
}

export function maskSensitiveFields(config: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const key in config) {
    const value = config[key];
    if (SENSITIVE_SERVER_CONFIG_FIELDS.includes(key as (typeof SENSITIVE_SERVER_CONFIG_FIELDS)[number]) && value) {
      result[key] = "••••••••";
    } else {
      result[key] = value;
    }
  }
  return result;
}

function normalizeWebhookConfigValue(value: unknown) {
  if (typeof value === "string" || value === undefined) {
    return value;
  }

  if (value && typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
}

function normalizeWebhookConfigResponse(config: Record<string, unknown>) {
  const result = { ...config };

  result["webhook.headers"] = normalizeWebhookConfigValue(result["webhook.headers"]);
  result["webhook.body_template"] = normalizeWebhookConfigValue(result["webhook.body_template"]);

  return result;
}

export function isAIConfigKey(key: string): boolean {
  return AI_CONFIG_KEYS.some((candidate) => candidate === key) || key.startsWith("ai_summary.");
}

export function splitConfigPayload(body: Record<string, unknown>) {
  const regularConfig: Record<string, unknown> = {};
  const aiConfigUpdates: Record<string, unknown> = {};

  for (const key in body) {
    if (isAIConfigKey(key)) {
      aiConfigUpdates[key.replace("ai_summary.", "")] = body[key];
    } else {
      regularConfig[key] = body[key];
    }
  }

  return { regularConfig, aiConfigUpdates };
}

export async function persistRegularConfig(
  config: ConfigMapLike,
  updates: Record<string, unknown>,
) {
  for (const key in updates) {
    await config.set(key, updates[key], false);
  }
  await config.save();
}

export async function getClientConfigWithDefaults(
  clientConfig: ConfigMapLike,
  env: Env,
): Promise<Record<string, unknown>> {
  const all = await clientConfig.all();
  const result: Record<string, unknown> = Object.fromEntries(all);

  for (const [configKey, envKey] of Object.entries(CLIENT_CONFIG_ENV_DEFAULTS)) {
    if (result[configKey] === undefined || result[configKey] === "") {
      const envValue = env[envKey as keyof Env];
      if (envValue) {
        result[configKey] = envValue;
      }
    }
  }

  if (result["site.page_size"] === undefined || result["site.page_size"] === "") {
    result["site.page_size"] = 5;
  }

  return result;
}

export async function buildServerConfigResponse(db: unknown, serverConfig: ConfigMapLike) {
  const all = await serverConfig.all();
  const configObj = normalizeWebhookConfigResponse(Object.fromEntries(all));
  const aiConfig = await getAIConfigForFrontend(db);

  configObj["ai_summary.enabled"] = String(aiConfig.enabled);
  configObj["ai_summary.provider"] = aiConfig.provider;
  configObj["ai_summary.model"] = aiConfig.model;
  configObj["ai_summary.api_url"] = aiConfig.api_url;
  configObj["ai_summary.api_key"] = aiConfig.api_key_set ? "••••••••" : "";

  return maskSensitiveFields(configObj);
}

export async function buildClientConfigResponse(
  db: unknown,
  clientConfig: ConfigMapLike,
  env: Env,
) {
  const clientConfigData = await getClientConfigWithDefaults(clientConfig, env);
  const aiConfig = await getAIConfigForFrontend(db);

  return {
    ...clientConfigData,
    "ai_summary.enabled": aiConfig.enabled ?? false,
  };
}

export async function buildCombinedConfigResponse(
  db: unknown,
  clientConfig: ConfigMapLike,
  serverConfig: ConfigMapLike,
  env: Env,
) {
  const [clientConfigData, serverConfigData] = await Promise.all([
    buildClientConfigResponse(db, clientConfig, env),
    buildServerConfigResponse(db, serverConfig),
  ]);

  return {
    clientConfig: clientConfigData,
    serverConfig: serverConfigData,
  };
}
