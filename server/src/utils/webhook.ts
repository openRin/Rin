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
