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
  headers?: string;
  bodyTemplate?: string;
}

function renderTemplate(template: string, payload: Record<string, string>) {
  return template.replaceAll(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_match, key: string) => {
    return payload[key] ?? "";
  });
}

export function buildWebhookRequest(
  payload: WebhookEventPayload,
  format: WebhookFormatConfig = {},
) {
  const method = (format.method || "POST").trim().toUpperCase() || "POST";
  const contentType = (format.contentType || "application/json").trim() || "application/json";
  const urlTemplate = format.urlTemplate?.trim() || "";
  const bodyTemplate = format.bodyTemplate?.trim() || "{\"content\":\"{{message}}\"}";
  const values: Record<string, string> = {
    event: payload.event,
    message: payload.message,
    title: payload.title || "",
    url: payload.url || "",
    username: payload.username || "",
    content: payload.content || "",
    description: payload.description || "",
  };

  const renderedBody = renderTemplate(bodyTemplate, values);
  const renderedHeadersTemplate = renderTemplate(format.headers?.trim() || "{}", values);
  const requestUrl = renderTemplate(urlTemplate, values).trim();
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
