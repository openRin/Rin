/**
 * 邮件发送 Provider 抽象：`smtp` / `resend` / `custom` 三种实现同一 `MailProvider` 接口。
 * 引入这层是因为 Workers 的 `cloudflare:sockets` 对 SMTP 直连限制多，
 * 而很多部署方已有自建 HTTP 网关；上层只依赖 `sendMail()`，不关心底层传输。
 */

export type MailProviderKind = 'smtp' | 'resend' | 'custom';

export type MailMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export interface MailProvider {
  kind: MailProviderKind;
  /** 展示用描述，仅用于日志与健康检查，不含任何凭证 */
  describe(): string;
  send(message: MailMessage): Promise<void>;
}

/** 邮件发送失败。`code` 保留底层错误信息便于排查。 */
export class MailDeliveryError extends Error {
  readonly provider: MailProviderKind;
  readonly status?: number;

  constructor(provider: MailProviderKind, message: string, status?: number) {
    super(message);
    this.name = 'MailDeliveryError';
    this.provider = provider;
    this.status = status;
  }
}

/**
 * 自定义 HTTP 网关的最小契约：POST {endpoint}，header 鉴权，
 * 请求体 { from, to, subject, text, html }，2xx 成功；可选返回 { ok, error? }。
 */
export type CustomGatewayConfig = {
  /** 网关地址，如 https://smtp.example.com/api/send */
  endpoint: string;
  /** 鉴权 token；留空表示网关不需要鉴权（不推荐） */
  token?: string;
  /** 鉴权头名称，默认 Authorization */
  authHeader?: string;
  /**
   * 鉴权头的值模板。默认 `Bearer {token}`。
   * 有些网关用 `X-Mail-Token: {token}` 或 `Token {token}`，这里可自定义。
   */
  authValueTemplate?: string;
  /** 请求体字段名映射，默认与标准字段同名 */
  fieldNames?: {
    from?: string;
    to?: string;
    subject?: string;
    text?: string;
    html?: string;
  };
  /** 发件人地址；网关若不支持可留空 */
  from?: string;
  /** 附加请求头 */
  headers?: Record<string, string>;
  /** 请求超时（毫秒），默认 15000 */
  timeoutMs?: number;
};
