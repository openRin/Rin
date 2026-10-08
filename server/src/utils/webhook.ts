export interface WebhookEventPayload {
  event: string;
  message: string;
  title?: string;
  url?: string;
  username?: string;
  content?: string;
  description?: string;
}

export interface WebhookFormatConfig {
  urlTemplate?: string;
  method?: string;
  contentType?: string;
  headers?: string | Record<string, unknown>;
  bodyTemplate?: string | Record<string, unknown>;
}

function renderTemplate(
  template: string,
  payload: Record<string, string>,
  transform: (value: string) => string = (value) => value,
) {
  return template.replaceAll(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_match, key: string) => {
    return transform(payload[key] ?? "");
  });
}

function normalizeTemplateValue(
  value: string | Record<string, unknown> | undefined,
  fallback: string,
) {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || fallback;
  }

  if (value && typeof value === "object") {
    return JSON.stringify(value);
  }

  return fallback;
}

function isJsonTemplate(template: string) {
  try {
    JSON.parse(template);
    return true;
  } catch {
    return false;
  }
}

function escapeJsonStringValue(value: string) {
  return JSON.stringify(value).slice(1, -1);
}

/**
 * 渲染后的 URL 必须仍落在模板的 origin 内。
 *
 * 占位符替换值虽经 encodeURIComponent，但点号等主机名字符不转义——
 * 管理员把 {{...}} 放在主机位时，payload 值仍能改写请求目的地（SSRF）。
 */
function assertWebhookUrlOrigin(urlTemplate: string, requestUrl: string) {
  let anchor: URL;
  let target: URL;
  try {
    anchor = new URL(urlTemplate.replaceAll(/{{\s*[a-zA-Z0-9_]+\s*}}/g, "origin-anchor.invalid"));
    target = new URL(requestUrl);
  } catch {
    throw new Error("Webhook URL template renders to an invalid URL");
  }

  if (target.origin !== anchor.origin) {
    throw new Error(
      `Webhook URL origin "${target.origin}" differs from the configured template origin "${anchor.origin}"`,
    );
  }
}

export function buildWebhookRequest(
  payload: WebhookEventPayload,
  format: WebhookFormatConfig = {},
) {
  const method = (format.method || "POST").trim().toUpperCase() || "POST";
  const contentType = (format.contentType || "application/json").trim() || "application/json";
  const urlTemplate = format.urlTemplate?.trim() || "";
  const bodyTemplate = normalizeTemplateValue(format.bodyTemplate, "{\"content\":\"{{message}}\"}");
  const values: Record<string, string> = {
    event: payload.event,
    message: payload.message,
    title: payload.title || "",
    url: payload.url || "",
    username: payload.username || "",
    content: payload.content || "",
    description: payload.description || "",
  };

  const headersTemplate = normalizeTemplateValue(format.headers, "{}");
  const renderedBody = renderTemplate(
    bodyTemplate,
    values,
    isJsonTemplate(bodyTemplate) ? escapeJsonStringValue : undefined,
  );
  const renderedHeadersTemplate = renderTemplate(
    headersTemplate,
    values,
    isJsonTemplate(headersTemplate) ? escapeJsonStringValue : undefined,
  );
  const requestUrl = renderTemplate(urlTemplate, values, encodeURIComponent).trim();
  assertWebhookUrlOrigin(urlTemplate, requestUrl);
  const parsedHeaders = JSON.parse(renderedHeadersTemplate) as Record<string, string>;
  const headers: Record<string, string> = {
    ...parsedHeaders,
  };
  if (!headers["Content-Type"] && !headers["content-type"]) {
    headers["Content-Type"] = contentType;
  }

  const allowsRequestBody = method !== "GET" && method !== "HEAD";
  if (!allowsRequestBody) {
    delete headers["Content-Type"];
    delete headers["content-type"];
  }

  return {
    url: requestUrl,
    method,
    headers,
    body: allowsRequestBody ? renderedBody : undefined,
  };
}

async function sendWebhook(url: string, method: string, body: string | undefined, headers: Record<string, string>) {
  return await fetch(url, {
    method,
    headers,
    body,
  });
}

export async function notify(
  webhookUrl: string,
  payload: WebhookEventPayload,
  format?: WebhookFormatConfig,
) {
  if (!webhookUrl) {
    console.error("Please set WEBHOOK_URL");
    return;
  }

  const request = buildWebhookRequest(payload, {
    ...format,
    urlTemplate: webhookUrl,
  });
  return await sendWebhook(request.url, request.method, request.body, request.headers);
}
