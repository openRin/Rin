import { WEBHOOK_URL_KEY } from "@rin/config";
import { getAIConfig } from "../utils/db-config";

type HealthStatus = "success" | "warning" | "danger";

export interface HealthCheckItem {
  id: string;
  title: string;
  status: HealthStatus;
  configured: boolean;
  impact: string;
  summary: string;
  suggestion?: string;
  details?: string[];
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

export async function buildHealthCheckResponse(
  db: any,
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
    getAIConfig(db),
  ]);

  const items: HealthCheckItem[] = [];
  const githubReady = Boolean(env.RIN_GITHUB_CLIENT_ID && env.RIN_GITHUB_CLIENT_SECRET);
  const passwordReady = Boolean(env.ADMIN_USERNAME && env.ADMIN_PASSWORD);
  const jwtReady = Boolean(env.JWT_SECRET);

  items.push(
    createItem(
      jwtReady
        ? {
            id: "auth-runtime",
            title: "Authentication runtime",
            status: "success",
            configured: true,
            impact: "Authentication cookies and token verification work normally.",
            summary: "JWT secret is configured.",
            suggestion: "Rotate the secret carefully if you need to invalidate all existing sessions.",
          }
        : {
            id: "auth-runtime",
            title: "Authentication runtime",
            status: "danger",
            configured: false,
            impact: "Login and admin session verification can fail completely.",
            summary: "JWT_SECRET is missing.",
            suggestion: "Add JWT_SECRET to your Worker secrets before using any authenticated route.",
          },
    ),
  );

  if (!loginEnabled) {
    items.push(
      createItem({
        id: "login-methods",
        title: "Login entry",
        status: "warning",
        configured: false,
        impact: "Public login is disabled, so the admin UI cannot be entered through normal login flows.",
        summary: "login.enabled is disabled.",
        suggestion: "Enable login in settings if this instance needs interactive admin access.",
      }),
    );
  } else if (!githubReady && !passwordReady) {
    items.push(
      createItem({
        id: "login-methods",
        title: "Login entry",
        status: "danger",
        configured: false,
        impact: "Users can see the login entry but no working login method is configured.",
        summary: "Neither GitHub OAuth nor password login is configured.",
        suggestion: "Configure RIN_GITHUB_CLIENT_ID/RIN_GITHUB_CLIENT_SECRET or ADMIN_USERNAME/ADMIN_PASSWORD.",
      }),
    );
  } else {
    const details = [
      `GitHub OAuth: ${githubReady ? "configured" : "missing"}`,
      `Password login: ${passwordReady ? "configured" : "missing"}`,
    ];
    items.push(
      createItem({
        id: "login-methods",
        title: "Login entry",
        status: githubReady && passwordReady ? "success" : "warning",
        configured: true,
        impact: "Admin sign-in is available.",
        summary: githubReady && passwordReady ? "Multiple login methods are configured." : "At least one login method is configured.",
        suggestion: githubReady && passwordReady ? "No action required." : "Optional: configure another login method as a fallback.",
        details,
      }),
    );
  }

  const requiredStorageKeys = [
    ["S3_ENDPOINT", env.S3_ENDPOINT],
    ["S3_BUCKET", env.S3_BUCKET],
    ["S3_ACCESS_KEY_ID", env.S3_ACCESS_KEY_ID],
    ["S3_SECRET_ACCESS_KEY", env.S3_SECRET_ACCESS_KEY],
  ] as const;
  const missingStorageKeys = requiredStorageKeys.filter(([, value]) => !value).map(([key]) => key);
  const hasAccessHost = Boolean(env.S3_ACCESS_HOST);

  if (missingStorageKeys.length === 0) {
    items.push(
      createItem({
        id: "storage",
        title: "Object storage",
        status: hasAccessHost ? "success" : "warning",
        configured: true,
        impact: "Uploads, favicon processing, and cached feed artifacts can use object storage.",
        summary: hasAccessHost ? "Storage credentials are configured." : "Storage works, but S3_ACCESS_HOST is missing so public URLs fall back to the endpoint.",
        suggestion: hasAccessHost ? "No action required." : "Set S3_ACCESS_HOST if you want stable public asset URLs or a custom asset domain.",
      }),
    );
  } else {
    items.push(
      createItem({
        id: "storage",
        title: "Object storage",
        status: missingStorageKeys.length === requiredStorageKeys.length ? "warning" : "danger",
        configured: false,
        impact: "Media upload, favicon generation, and pre-generated feed cache can fail or be unavailable.",
        summary:
          missingStorageKeys.length === requiredStorageKeys.length
            ? "Object storage is not configured."
            : `Object storage is partially configured. Missing: ${missingStorageKeys.join(", ")}.`,
        suggestion: "Set the full S3/R2 credential set before relying on uploads or remote cache artifacts.",
        details: missingStorageKeys,
      }),
    );
  }

  if (!aiConfig.enabled) {
    items.push(
      createItem({
        id: "ai-summary",
        title: "AI summary",
        status: "warning",
        configured: false,
        impact: "Articles will be published without AI-generated summaries.",
        summary: "AI summary is disabled.",
        suggestion: "Enable it in settings if you want summary generation during publishing.",
      }),
    );
  } else if (!aiConfig.model) {
    items.push(
      createItem({
        id: "ai-summary",
        title: "AI summary",
        status: "danger",
        configured: false,
        impact: "Summary generation can fail during publish and update operations.",
        summary: "AI summary is enabled but no model is configured.",
        suggestion: "Choose a model in settings before enabling AI summary.",
      }),
    );
  } else if (aiConfig.provider === "worker-ai") {
    const workerAiReady = Boolean(env.AI && typeof env.AI.run === "function");
    items.push(
      createItem(
        workerAiReady
          ? {
              id: "ai-summary",
              title: "AI summary",
              status: "success",
              configured: true,
              impact: "AI summaries can be generated through Workers AI.",
              summary: `Workers AI is configured for model ${aiConfig.model}.`,
              suggestion: "No action required.",
            }
          : {
              id: "ai-summary",
              title: "AI summary",
              status: "danger",
              configured: false,
              impact: "AI summary requests will fail when publishing content.",
              summary: "AI summary uses worker-ai but the Workers AI binding is missing.",
              suggestion: "Add the AI binding in wrangler configuration before using the worker-ai provider.",
            },
      ),
    );
  } else {
    const hasApiKey = Boolean(aiConfig.api_key);
    const hasApiUrl = Boolean(aiConfig.api_url || AI_PROVIDER_DEFAULT_URLS[aiConfig.provider]);
    const aiDetails = [`Provider: ${aiConfig.provider}`, `Model: ${aiConfig.model}`];
    items.push(
      createItem(
        hasApiKey && hasApiUrl
          ? {
              id: "ai-summary",
              title: "AI summary",
              status: "success",
              configured: true,
              impact: "AI summaries can be generated with the configured external provider.",
              summary: `${aiConfig.provider} is configured for AI summaries.`,
              suggestion: "Use the test action in settings if you want to validate the remote model response.",
              details: aiDetails,
            }
          : {
              id: "ai-summary",
              title: "AI summary",
              status: "danger",
              configured: false,
              impact: "AI summary requests will fail when publishing content.",
              summary: hasApiKey ? "AI provider URL is missing." : "AI provider key is missing.",
              suggestion: "Configure the provider credentials in settings before enabling AI summary.",
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
            title: "Webhook notifications",
            status: "success",
            configured: true,
            impact: "Comment and friend-application notifications can be sent to the configured webhook.",
            summary: "Webhook URL is configured.",
            suggestion: friendCrontab ? "No action required." : "Optional: enable friend_crontab if you also want scheduled friend health checks.",
          }
        : {
            id: "webhook",
            title: "Webhook notifications",
            status: "warning",
            configured: false,
            impact: "Comment and friend events will not push notifications to external chat tools.",
            summary: "Webhook URL is not configured.",
            suggestion: "Set WEBHOOK_URL in server config or environment if you rely on external notifications.",
          },
    ),
  );

  items.push(
    createItem(
      rssEnabled
        ? {
            id: "rss",
            title: "RSS and feed endpoints",
            status: missingStorageKeys.length === 0 ? "success" : "warning",
            configured: true,
            impact: "Feed endpoints are enabled; without storage they fall back to on-demand generation.",
            summary: missingStorageKeys.length === 0 ? "RSS is enabled and storage can cache generated feed artifacts." : "RSS is enabled, but feed artifacts will be generated on demand because storage is incomplete.",
            suggestion: missingStorageKeys.length === 0 ? "No action required." : "Configure object storage if you want feed artifacts to be cached remotely.",
          }
        : {
            id: "rss",
            title: "RSS and feed endpoints",
            status: "warning",
            configured: false,
            impact: "Visitors will not see RSS/Atom links in the public site footer.",
            summary: "RSS is disabled in client settings.",
            suggestion: "Enable RSS in settings if you want feed discovery links and feed endpoints exposed.",
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
            title: "Site identity",
            status: finalSiteAvatar ? "success" : "warning",
            configured: true,
            impact: "Visitors can see the configured site name across the UI.",
            summary: finalSiteAvatar ? `Site identity is configured for ${finalSiteName}.` : `Site name is configured for ${finalSiteName}, but avatar is missing.`,
            suggestion: finalSiteAvatar ? "No action required." : "Add a site avatar if you want richer header, sharing, and feed presentation.",
          }
        : {
            id: "site-identity",
            title: "Site identity",
            status: "warning",
            configured: false,
            impact: "The site falls back to the default product name, which makes the instance look unfinished.",
            summary: "Site name is not configured.",
            suggestion: "Set site.name in settings or NAME in the environment.",
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
