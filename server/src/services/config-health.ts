import { WEBHOOK_URL_KEY } from "@rin/config";
import { getAIConfig } from "../utils/db-config";

type HealthStatus = "success" | "warning" | "danger";
type HealthTextValues = Record<string, string | number | boolean>;

export interface HealthText {
  key: string;
  values?: HealthTextValues;
}

export interface HealthCheckItem {
  id: string;
  title: HealthText;
  status: HealthStatus;
  configured: boolean;
  impact: HealthText;
  summary: HealthText;
  suggestion?: HealthText;
  details?: HealthText[];
}

export interface HealthCheckResponse {
  generatedAt: string;
  summary: Record<HealthStatus, number>;
  items: HealthCheckItem[];
}

const AI_PROVIDER_DEFAULT_URLS: Record<string, string> = {
  openai: "https://api.openai.com/v1",
  claude: "https://api.anthropic.com/v1",
  gemini: "https://generativelanguage.googleapis.com/v1beta/openai",
  deepseek: "https://api.deepseek.com/v1",
};

function createItem(item: HealthCheckItem): HealthCheckItem {
  return item;
}

function text(key: string, values?: HealthTextValues): HealthText {
  return values ? { key, values } : { key };
}

export async function buildHealthCheckResponse(
  clientConfig: { get: (key: string) => Promise<any>; getOrDefault: <T>(key: string, defaultValue: T) => Promise<T> },
  serverConfig: { get: (key: string) => Promise<any>; getOrDefault: <T>(key: string, defaultValue: T) => Promise<T> },
  env: Env,
): Promise<HealthCheckResponse> {
  const [
    loginEnabled,
    rssEnabled,
    siteName,
    siteAvatar,
    webhookUrl,
    friendCrontab,
    aiConfig,
  ] = await Promise.all([
    clientConfig.getOrDefault("login.enabled", true),
    clientConfig.getOrDefault("rss", false),
    clientConfig.get("site.name"),
    clientConfig.get("site.avatar"),
    serverConfig.get(WEBHOOK_URL_KEY),
    serverConfig.getOrDefault("friend_crontab", true),
    getAIConfig(serverConfig),
  ]);

  const items: HealthCheckItem[] = [];
  const githubReady = Boolean(env.RIN_GITHUB_CLIENT_ID && env.RIN_GITHUB_CLIENT_SECRET);
  const passwordReady = Boolean(env.ADMIN_USERNAME && env.ADMIN_PASSWORD);
  const defaultPasswordInUse =
    env.ADMIN_USERNAME === "admin" && env.ADMIN_PASSWORD === "admin123";
  const jwtReady = Boolean(env.JWT_SECRET);

  items.push(
    createItem(
      jwtReady
        ? {
            id: "auth-runtime",
            title: text("health.items.auth_runtime.title"),
            status: "success",
            configured: true,
            impact: text("health.items.auth_runtime.success.impact"),
            summary: text("health.items.auth_runtime.success.summary"),
            suggestion: text("health.items.auth_runtime.success.suggestion"),
          }
        : {
            id: "auth-runtime",
            title: text("health.items.auth_runtime.title"),
            status: "danger",
            configured: false,
            impact: text("health.items.auth_runtime.danger.impact"),
            summary: text("health.items.auth_runtime.danger.summary"),
            suggestion: text("health.items.auth_runtime.danger.suggestion"),
          },
    ),
  );

  if (!loginEnabled) {
    items.push(
      createItem({
        id: "login-methods",
        title: text("health.items.login_methods.title"),
        status: "warning",
        configured: false,
        impact: text("health.items.login_methods.disabled.impact"),
        summary: text("health.items.login_methods.disabled.summary"),
        suggestion: text("health.items.login_methods.disabled.suggestion"),
      }),
    );
  } else if (!githubReady && !passwordReady) {
    items.push(
      createItem({
        id: "login-methods",
        title: text("health.items.login_methods.title"),
        status: "danger",
        configured: false,
        impact: text("health.items.login_methods.missing.impact"),
        summary: text("health.items.login_methods.missing.summary"),
        suggestion: text("health.items.login_methods.missing.suggestion"),
      }),
    );
  } else if (passwordReady && defaultPasswordInUse) {
    items.push(
      createItem({
        id: "login-methods",
        title: text("health.items.login_methods.title"),
        status: "danger",
        configured: false,
        impact: text("health.items.login_methods.default_password.impact"),
        summary: text("health.items.login_methods.default_password.summary"),
        suggestion: text("health.items.login_methods.default_password.suggestion"),
        details: [
          githubReady
            ? text("health.items.login_methods.details.github_configured")
            : text("health.items.login_methods.details.github_missing"),
          text("health.items.login_methods.details.password_default"),
        ],
      }),
    );
  } else if (!githubReady) {
    items.push(
      createItem({
        id: "login-methods",
        title: text("health.items.login_methods.title"),
        status: "warning",
        configured: true,
        impact: text("health.items.login_methods.oauth_missing.impact"),
        summary: text("health.items.login_methods.oauth_missing.summary"),
        suggestion: text("health.items.login_methods.oauth_missing.suggestion"),
        details: [
          text("health.items.login_methods.details.github_missing"),
          passwordReady
            ? text("health.items.login_methods.details.password_configured")
            : text("health.items.login_methods.details.password_missing"),
        ],
      }),
    );
  } else {
    const details = [
      text("health.items.login_methods.details.github_configured"),
      passwordReady
        ? text("health.items.login_methods.details.password_configured")
        : text("health.items.login_methods.details.password_missing"),
    ];
    items.push(
      createItem({
        id: "login-methods",
        title: text("health.items.login_methods.title"),
        status: "success",
        configured: true,
        impact: text("health.items.login_methods.ready.impact"),
        summary: text("health.items.login_methods.ready.summary"),
        suggestion: text("health.items.login_methods.ready.suggestion"),
        details,
      }),
    );
  }

  const usesR2Binding = Boolean(env.R2_BUCKET);
  const requiredStorageKeys = usesR2Binding
    ? ([] as const)
    : ([
        ["S3_ENDPOINT", env.S3_ENDPOINT],
        ["S3_BUCKET", env.S3_BUCKET],
        ["S3_ACCESS_KEY_ID", env.S3_ACCESS_KEY_ID],
        ["S3_SECRET_ACCESS_KEY", env.S3_SECRET_ACCESS_KEY],
      ] as const);
  const missingStorageKeys = requiredStorageKeys.filter(([, value]) => !value).map(([key]) => key);
  const hasAccessHost = Boolean(env.S3_ACCESS_HOST);

  if (missingStorageKeys.length === 0) {
    items.push(
      createItem({
        id: "storage",
        title: text("health.items.storage.title"),
        status: "success",
        configured: true,
        impact: text("health.items.storage.ready.impact"),
        summary: text("health.items.storage.ready.summary"),
        suggestion: text("health.items.common.no_action"),
      }),
    );
  } else {
    items.push(
      createItem({
        id: "storage",
        title: text("health.items.storage.title"),
        status: missingStorageKeys.length === requiredStorageKeys.length ? "warning" : "danger",
        configured: false,
        impact: text("health.items.storage.missing.impact"),
        summary:
          missingStorageKeys.length === requiredStorageKeys.length
            ? text("health.items.storage.missing.summary_none")
            : text("health.items.storage.missing.summary_partial", { keys: missingStorageKeys.join(", ") }),
        suggestion: text("health.items.storage.missing.suggestion"),
        details: missingStorageKeys.map((key) => text("health.items.storage.details.key", { key })),
      }),
    );
  }

  if (!aiConfig.enabled) {
    items.push(
      createItem({
        id: "ai-summary",
        title: text("health.items.ai_summary.title"),
        status: "warning",
        configured: false,
        impact: text("health.items.ai_summary.disabled.impact"),
        summary: text("health.items.ai_summary.disabled.summary"),
        suggestion: text("health.items.ai_summary.disabled.suggestion"),
      }),
    );
  } else if (!aiConfig.model) {
    items.push(
      createItem({
        id: "ai-summary",
        title: text("health.items.ai_summary.title"),
        status: "danger",
        configured: false,
        impact: text("health.items.ai_summary.no_model.impact"),
        summary: text("health.items.ai_summary.no_model.summary"),
        suggestion: text("health.items.ai_summary.no_model.suggestion"),
      }),
    );
  } else if (aiConfig.provider === "worker-ai") {
    const workerAiReady = Boolean(env.AI && typeof env.AI.run === "function");
    items.push(
      createItem(
        workerAiReady
          ? {
              id: "ai-summary",
              title: text("health.items.ai_summary.title"),
              status: "success",
              configured: true,
              impact: text("health.items.ai_summary.worker_ai.ready.impact"),
              summary: text("health.items.ai_summary.worker_ai.ready.summary", { model: aiConfig.model }),
              suggestion: text("health.items.common.no_action"),
            }
          : {
              id: "ai-summary",
              title: text("health.items.ai_summary.title"),
              status: "danger",
              configured: false,
              impact: text("health.items.ai_summary.worker_ai.missing.impact"),
              summary: text("health.items.ai_summary.worker_ai.missing.summary"),
              suggestion: text("health.items.ai_summary.worker_ai.missing.suggestion"),
            },
      ),
    );
  } else {
    const hasApiKey = Boolean(aiConfig.api_key);
    const hasApiUrl = Boolean(aiConfig.api_url || AI_PROVIDER_DEFAULT_URLS[aiConfig.provider]);
    const aiDetails = [
      text("health.items.ai_summary.external.details.provider", { provider: aiConfig.provider }),
      text("health.items.ai_summary.external.details.model", { model: aiConfig.model }),
    ];
    items.push(
      createItem(
        hasApiKey && hasApiUrl
          ? {
              id: "ai-summary",
              title: text("health.items.ai_summary.title"),
              status: "success",
              configured: true,
              impact: text("health.items.ai_summary.external.ready.impact"),
              summary: text("health.items.ai_summary.external.ready.summary", { provider: aiConfig.provider }),
              suggestion: text("health.items.ai_summary.external.ready.suggestion"),
              details: aiDetails,
            }
          : {
              id: "ai-summary",
              title: text("health.items.ai_summary.title"),
              status: "danger",
              configured: false,
              impact: text("health.items.ai_summary.external.missing.impact"),
              summary: hasApiKey
                ? text("health.items.ai_summary.external.missing.summary_url")
                : text("health.items.ai_summary.external.missing.summary_key"),
              suggestion: text("health.items.ai_summary.external.missing.suggestion"),
              details: aiDetails,
            },
      ),
    );
  }

  const webhookValue = (webhookUrl || env.WEBHOOK_URL || "").toString();
  items.push(
    createItem(
      webhookValue
        ? {
            id: "webhook",
            title: text("health.items.webhook.title"),
            status: "success",
            configured: true,
            impact: text("health.items.webhook.ready.impact"),
            summary: text("health.items.webhook.ready.summary"),
            suggestion: friendCrontab
              ? text("health.items.common.no_action")
              : text("health.items.webhook.ready.suggestion_optional"),
          }
        : {
            id: "webhook",
            title: text("health.items.webhook.title"),
            status: "warning",
            configured: false,
            impact: text("health.items.webhook.missing.impact"),
            summary: text("health.items.webhook.missing.summary"),
            suggestion: text("health.items.webhook.missing.suggestion"),
          },
    ),
  );

  items.push(
    createItem(
      rssEnabled
        ? {
            id: "rss",
            title: text("health.items.rss.title"),
            status: missingStorageKeys.length === 0 ? "success" : "warning",
            configured: true,
            impact: text("health.items.rss.enabled.impact"),
            summary: missingStorageKeys.length === 0
              ? text("health.items.rss.enabled.summary_cached")
              : text("health.items.rss.enabled.summary_on_demand"),
            suggestion: missingStorageKeys.length === 0
              ? text("health.items.common.no_action")
              : text("health.items.rss.enabled.suggestion"),
          }
        : {
            id: "rss",
            title: text("health.items.rss.title"),
            status: "warning",
            configured: false,
            impact: text("health.items.rss.disabled.impact"),
            summary: text("health.items.rss.disabled.summary"),
            suggestion: text("health.items.rss.disabled.suggestion"),
          },
    ),
  );

  const finalSiteName = String(siteName || "").trim();
  const finalSiteAvatar = String(siteAvatar || "").trim();
  items.push(
    createItem(
      finalSiteName
        ? {
            id: "site-identity",
            title: text("health.items.site_identity.title"),
            status: finalSiteAvatar ? "success" : "warning",
            configured: true,
            impact: text("health.items.site_identity.ready.impact"),
            summary: finalSiteAvatar
              ? text("health.items.site_identity.ready.summary", { name: finalSiteName })
              : text("health.items.site_identity.ready.summary_missing_avatar", { name: finalSiteName }),
            suggestion: finalSiteAvatar
              ? text("health.items.common.no_action")
              : text("health.items.site_identity.ready.suggestion_missing_avatar"),
          }
        : {
            id: "site-identity",
            title: text("health.items.site_identity.title"),
            status: "warning",
            configured: false,
            impact: text("health.items.site_identity.missing.impact"),
            summary: text("health.items.site_identity.missing.summary"),
            suggestion: text("health.items.site_identity.missing.suggestion"),
          },
    ),
  );

  const summary = items.reduce(
    (result, item) => {
      result[item.status] += 1;
      return result;
    },
    { success: 0, warning: 0, danger: 0 } as Record<HealthStatus, number>,
  );

  return {
    generatedAt: new Date().toISOString(),
    summary,
    items,
  };
}
