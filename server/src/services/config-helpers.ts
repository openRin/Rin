import {
  AI_CONFIG_KEYS,
  CLIENT_CONFIG_ENV_DEFAULTS,
  SENSITIVE_SERVER_CONFIG_FIELDS,
  WEBHOOK_URL_KEY,
} from "@rin/config";
import { getFrontendAIEnabled, readAIConfigFromMap } from "../utils/db-config";

type ConfigMapLike = {
  all(): Promise<Map<string, unknown>>;
  set(key: string, value: unknown, save?: boolean): Promise<void>;
  save(): Promise<void>;
};

type ConfigReaderLike = {
  get(key: string): Promise<unknown>;
};

type ConfigProfiler = <T>(name: string, task: () => Promise<T>) => Promise<T>;

type ServerConfigResponseEnv = {
  WEBHOOK_URL?: string;
};

type WebhookConfigOverrides = {
  webhook_url?: string;
  "webhook.method"?: string;
  "webhook.content_type"?: string;
  "webhook.headers"?: string | Record<string, unknown>;
  "webhook.body_template"?: string | Record<string, unknown>;
};

type WebhookConfigEnv = {
  WEBHOOK_URL?: string;
};

export type ResolvedWebhookConfig = {
  webhookUrl?: string;
  webhookMethod?: string;
  webhookContentType?: string;
  webhookHeaders?: string | Record<string, unknown>;
  webhookBodyTemplate?: string | Record<string, unknown>;
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

function normalizeOptionalString(value: unknown) {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeWebhookTemplateConfigValue(value: unknown) {
  if (typeof value === "string") {
    return value;
  }

  if (value && typeof value === "object") {
    return value as Record<string, unknown>;
  }

  return undefined;
}

export async function resolveWebhookConfig(
  serverConfig: ConfigReaderLike,
  env?: WebhookConfigEnv,
  overrides: WebhookConfigOverrides = {},
): Promise<ResolvedWebhookConfig> {
  const [
    storedWebhookUrl,
    legacyWebhookUrl,
    webhookMethod,
    webhookContentType,
    webhookHeaders,
    webhookBodyTemplate,
  ] = await Promise.all([
    serverConfig.get("webhook_url"),
    serverConfig.get(WEBHOOK_URL_KEY),
    serverConfig.get("webhook.method"),
    serverConfig.get("webhook.content_type"),
    serverConfig.get("webhook.headers"),
    serverConfig.get("webhook.body_template"),
  ]);

  return {
    webhookUrl:
      normalizeOptionalString(overrides.webhook_url) ??
      normalizeOptionalString(storedWebhookUrl) ??
      normalizeOptionalString(legacyWebhookUrl) ??
      normalizeOptionalString(env?.WEBHOOK_URL),
    webhookMethod: normalizeOptionalString(overrides["webhook.method"]) ?? normalizeOptionalString(webhookMethod),
    webhookContentType:
      normalizeOptionalString(overrides["webhook.content_type"]) ?? normalizeOptionalString(webhookContentType),
    webhookHeaders:
      normalizeWebhookTemplateConfigValue(overrides["webhook.headers"]) ??
      normalizeWebhookTemplateConfigValue(webhookHeaders),
    webhookBodyTemplate:
      normalizeWebhookTemplateConfigValue(overrides["webhook.body_template"]) ??
      normalizeWebhookTemplateConfigValue(webhookBodyTemplate),
  };
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
  profile?: ConfigProfiler,
): Promise<Record<string, unknown>> {
  const all = profile
    ? await profile("client_config_all", () => clientConfig.all())
    : await clientConfig.all();
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

export async function buildServerConfigResponse(
  serverConfig: ConfigMapLike,
  env?: ServerConfigResponseEnv,
) {
  const all = await serverConfig.all();
  const configObj = normalizeWebhookConfigResponse(Object.fromEntries(all));
  const aiConfig = readAIConfigFromMap(all);
  const webhookUrlValue = configObj["webhook_url"] ?? configObj[WEBHOOK_URL_KEY] ?? env?.WEBHOOK_URL;

  if (webhookUrlValue !== undefined && webhookUrlValue !== "") {
    configObj["webhook_url"] = webhookUrlValue;
  }

  if ((configObj[WEBHOOK_URL_KEY] === undefined || configObj[WEBHOOK_URL_KEY] === "") && env?.WEBHOOK_URL) {
    configObj[WEBHOOK_URL_KEY] = env.WEBHOOK_URL;
  }

  configObj["ai_summary.enabled"] = String(aiConfig.enabled);
  configObj["ai_summary.provider"] = aiConfig.provider;
  configObj["ai_summary.model"] = aiConfig.model;
  configObj["ai_summary.api_url"] = aiConfig.api_url;
  configObj["ai_summary.api_key"] = aiConfig.api_key.length > 0 ? "••••••••" : "";

  return maskSensitiveFields(configObj);
}

export async function buildClientConfigResponse(
  clientConfig: ConfigMapLike,
  serverConfig: ConfigReaderLike,
  env: Env,
  profile?: ConfigProfiler,
) {
  const clientConfigData = profile
    ? await profile("client_config_defaults", () => getClientConfigWithDefaults(clientConfig, env, profile))
    : await getClientConfigWithDefaults(clientConfig, env);
  const aiEnabled = profile
    ? await profile("client_ai_enabled", () => getFrontendAIEnabled(serverConfig))
    : await getFrontendAIEnabled(serverConfig);

  return {
    ...clientConfigData,
    "ai_summary.enabled": aiEnabled,
  };
}

export async function buildCombinedConfigResponse(
  clientConfig: ConfigMapLike,
  serverConfig: ConfigMapLike & ConfigReaderLike,
  env: Env,
) {
  const [clientConfigData, serverConfigData] = await Promise.all([
    buildClientConfigResponse(clientConfig, serverConfig, env),
    buildServerConfigResponse(serverConfig, env),
  ]);

  return {
    clientConfig: clientConfigData,
    serverConfig: serverConfigData,
  };
}
