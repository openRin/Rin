import {
  MailDeliveryError,
  type CustomGatewayConfig,
  type MailMessage,
  type MailProvider,
  type MailProviderKind,
} from './types';

/**
 * 基于 HTTP 的邮件 Provider，覆盖两类场景：
 * 1. `resend` —— Resend 官方 API（及兼容其请求体格式的网关）
 * 2. `custom` —— 字段名与鉴权头均可配的自建网关
 * 优先 HTTP 而非 SMTP 直连：Workers 的出站端口受限，把复杂度留给网关侧。
 */

type HttpProviderOptions = {
  kind: Extract<MailProviderKind, 'resend' | 'custom'>;
  /** API 端点，如 https://api.resend.com/emails */
  endpoint: string;
  /** 鉴权 token（静态） */
  token?: string;
  /**
   * 动态鉴权回调，返回值按 authValueTemplate 填入鉴权头。
   * 支持"每次请求现签"的短期凭证（见 token.ts）；与静态 token 同时存在时优先。
   */
  getToken?: () => Promise<string | null | undefined>;
  /** 鉴权头名称，默认 Authorization */
  authHeader?: string;
  /** 鉴权值模板，默认 `Bearer {token}` */
  authValueTemplate?: string;
  /** 请求体字段名映射 */
  fieldNames?: CustomGatewayConfig['fieldNames'];
  /** 发件人地址 */
  from?: string;
  /** 附加请求头 */
  headers?: Record<string, string>;
  /** 超时（毫秒） */
  timeoutMs?: number;
};

const DEFAULT_TIMEOUT_MS = 15_000;

export function createHttpMailProvider(options: HttpProviderOptions): MailProvider {
  const {
    kind,
    endpoint,
    token,
    getToken,
    authHeader = 'Authorization',
    authValueTemplate,
    fieldNames,
    from,
    headers = {},
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = options;

  // Resend 的 from 是必填；custom 网关允许网关侧自己配置发件人
  const fields = {
    from: fieldNames?.from ?? 'from',
    to: fieldNames?.to ?? 'to',
    subject: fieldNames?.subject ?? 'subject',
    text: fieldNames?.text ?? 'text',
    html: fieldNames?.html ?? 'html',
  };

  return {
    kind,

    describe() {
      const host = safeHost(endpoint);
      return `${kind} via ${host}`;
    },

    async send(message: MailMessage) {
      if (!endpoint) {
        throw new MailDeliveryError(kind, 'Mail gateway endpoint is not configured');
      }

      const body: Record<string, string> = {
        [fields.to]: message.to,
        [fields.subject]: message.subject,
        [fields.text]: message.text,
      };

      if (from) {
        body[fields.from] = from;
      }

      // 纯文本已经够用时不发 html，避免部分网关对空字段处理不一致
      if (message.html) {
        body[fields.html] = message.html;
      }

      const requestHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...headers,
      };

      // 动态凭证优先：短期 JWT 每次现签，避免长期 token 泄露后的暴露窗口
      let effectiveToken = token;
      if (getToken) {
        try {
          const fresh = await getToken();
          if (fresh) {
            effectiveToken = fresh;
          }
        } catch (error) {
          throw new MailDeliveryError(
            kind,
            `Failed to sign gateway credential: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }

      if (effectiveToken) {
        requestHeaders[authHeader] = renderAuthValue(authValueTemplate, effectiveToken);
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      let response: Response;
      try {
        response = await fetch(endpoint, {
          method: 'POST',
          headers: requestHeaders,
          body: JSON.stringify(body),
          signal: controller.signal,
        });
      } catch (error) {
        // 区分超时与网络故障，便于运维定位
        const isAbort = error instanceof Error && error.name === 'AbortError';
        throw new MailDeliveryError(
          kind,
          isAbort
            ? `Mail gateway timed out after ${timeoutMs}ms`
            : `Failed to reach mail gateway: ${error instanceof Error ? error.message : String(error)}`,
        );
      } finally {
        clearTimeout(timer);
      }

      if (!response.ok) {
        const detail = await safeReadBody(response);
        throw new MailDeliveryError(
          kind,
          `Mail gateway returned ${response.status}${detail ? `: ${detail}` : ''}`,
          response.status,
        );
      }

      // 网关可能返回 200 但体内 { ok: false }，需要进一步判断
      const body2 = await safeReadJson(response);
      if (body2 && typeof body2 === 'object' && 'ok' in body2 && body2.ok === false) {
        const error = (body2 as { error?: unknown }).error;
        throw new MailDeliveryError(
          kind,
          `Mail gateway rejected the request: ${typeof error === 'string' ? error : 'unknown reason'}`,
          response.status,
        );
      }
    },
  };
}

/**
 * Resend 专用 Provider。
 * 与 custom 的差别：字段名固定为 Resend 规范，鉴权固定 Bearer。
 */
export function createResendProvider(options: {
  apiKey: string;
  from: string;
  /** 覆盖默认端点，用于兼容 Resend 兼容网关或代理 */
  endpoint?: string;
  timeoutMs?: number;
}): MailProvider {
  return createHttpMailProvider({
    kind: 'resend',
    endpoint: options.endpoint || 'https://api.resend.com/emails',
    token: options.apiKey,
    from: options.from,
    timeoutMs: options.timeoutMs,
  });
}

function renderAuthValue(template: string | undefined, token: string) {
  // 默认 Bearer；模板里用 {token} 占位，方便适配 `Token {token}` 之类的网关
  const effective = template ?? 'Bearer {token}';
  return effective.replace('{token}', token);
}

function safeHost(endpoint: string): string {
  try {
    return new URL(endpoint).host;
  } catch {
    return endpoint;
  }
}

async function safeReadBody(response: Response): Promise<string> {
  try {
    const text = await response.text();
    // 网关可能返回 HTML 错误页，截断避免日志爆炸
    return text.slice(0, 200);
  } catch {
    return '';
  }
}

async function safeReadJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}
