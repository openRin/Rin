import { AUTH_ERROR_CODES } from "@rin/api";
import { bizError } from "../errors";
import { createHttpMailProvider, createResendProvider } from "./mail/http";
import { createSmtpMailProvider } from "./mail/smtp";
import { resolveMailSigningSecret, signMailGatewayToken } from "./mail/token";
import type { MailProvider, MailProviderKind } from "./mail/types";
import { MailDeliveryError } from "./mail/types";
import { resolveTlsMode } from "./smtp";

/**
 * 邮件发送门面（多 Provider）：选 Provider、组装内容、把底层异常翻译成业务错误码。
 * Provider 选择：显式配置（MAIL_PROVIDER env 或 mail.provider config）优先，
 * 未指定时按已配置的凭证自动探测 resend → custom → smtp。
 */

type ConfigReader = {
  get(key: string): Promise<unknown>;
  getOrDefault<T>(key: string, defaultValue: T): Promise<T>;
};

export type ResolvedMailConfig = {
  kind: MailProviderKind;
  registerEnabled: boolean;
  /** 用于日志与健康检查的描述，不含凭证 */
  describe: string;
  provider: MailProvider;
};

export function isRegistrationAvailable(config: ResolvedMailConfig | null): boolean {
  return Boolean(config?.registerEnabled);
}

/**
 * 解析邮件配置并构造对应 Provider。
 * 返回 null 表示未配置，调用方应关闭注册功能而不是进入半可用状态。
 */
export async function resolveMailConfig(
  serverConfig: ConfigReader,
  env: Env,
): Promise<ResolvedMailConfig | null> {
  const [
    registerEnabled,
    explicitProvider,
    // SMTP
    smtpHost,
    smtpPort,
    smtpUsername,
    smtpPassword,
    smtpFrom,
    smtpFromName,
    smtpTlsMode,
    smtpAuthMethod,
    // Resend
    resendKey,
    resendEndpoint,
    // Custom gateway
    gatewayEndpoint,
    gatewayToken,
    gatewayAuthHeader,
    gatewayAuthTemplate,
    gatewayFromField,
    gatewayToField,
    gatewaySubjectField,
    gatewayTextField,
    gatewayHtmlField,
    // 共用
    mailFrom,
    timeoutMs,
  ] = await Promise.all([
    serverConfig.getOrDefault<boolean>("register.enabled", true),
    serverConfig.get("mail.provider"),

    serverConfig.get("smtp.host"),
    serverConfig.get("smtp.port"),
    serverConfig.get("smtp.username"),
    serverConfig.get("smtp.password"),
    serverConfig.get("smtp.from"),
    serverConfig.get("smtp.from_name"),
    serverConfig.get("smtp.tls_mode"),
    serverConfig.get("smtp.auth_method"),

    serverConfig.get("resend.api_key"),
    serverConfig.get("resend.endpoint"),

    serverConfig.get("mail.gateway_endpoint"),
    serverConfig.get("mail.gateway_token"),
    serverConfig.get("mail.gateway_auth_header"),
    serverConfig.get("mail.gateway_auth_template"),
    serverConfig.get("mail.gateway_from_field"),
    serverConfig.get("mail.gateway_to_field"),
    serverConfig.get("mail.gateway_subject_field"),
    serverConfig.get("mail.gateway_text_field"),
    serverConfig.get("mail.gateway_html_field"),

    serverConfig.get("mail.from"),
    serverConfig.get("mail.timeout_ms"),
  ]);

  const kind = resolveProviderKind({
    explicit: normalizeString(explicitProvider) || normalizeString(env.MAIL_PROVIDER),
    hasResend: Boolean(pick(resendKey, env.RESEND_API_KEY)),
    hasGateway: Boolean(pick(gatewayEndpoint, env.MAIL_GATEWAY_ENDPOINT)),
    hasSmtp: Boolean(
      pick(smtpHost, env.SMTP_HOST) &&
      pick(smtpUsername, env.SMTP_USERNAME) &&
      pick(smtpPassword, env.SMTP_PASSWORD),
    ),
  });

  if (!kind) {
    return null;
  }

  const from = pick(mailFrom, env.MAIL_FROM) ||
    pick(smtpFrom, env.SMTP_FROM) ||
    pick(resendKey, env.RESEND_API_KEY); // 仅用于判断存在性，实际发件人下面单独校验
  const resolvedTimeout = toPositiveInt(timeoutMs) ?? toPositiveInt(env.MAIL_TIMEOUT_MS) ?? undefined;

  if (kind === 'resend') {
    const apiKey = pick(resendKey, env.RESEND_API_KEY);
    // Resend 要求显式发件人，否则会被 API 拒绝
    const resendFrom = pick(smtpFrom, env.SMTP_FROM) || pick(mailFrom, env.MAIL_FROM);

    if (!apiKey || !resendFrom) {
      return null;
    }

    const endpoint = pick(resendEndpoint, env.RESEND_ENDPOINT);
    const provider = createResendProvider({
      apiKey,
      from: resendFrom,
      endpoint: endpoint || undefined,
      timeoutMs: resolvedTimeout,
    });

    return {
      kind,
      registerEnabled: registerEnabled !== false,
      describe: provider.describe(),
      provider,
    };
  }

  if (kind === 'custom') {
    const endpoint = pick(gatewayEndpoint, env.MAIL_GATEWAY_ENDPOINT);
    const token = pick(gatewayToken, env.MAIL_GATEWAY_TOKEN);

    if (!endpoint) {
      return null;
    }

    // 鉴权优先级：JWT 模式（每次现签短期 token）优先于静态 token；都没配时网关会拒绝 —— 这是期望行为。
    const jwtSecret = resolveMailSigningSecret(env);
    const useJwtAuth = Boolean(jwtSecret) && !token;

    const provider = createHttpMailProvider({
      kind: 'custom',
      endpoint,
      token: token || undefined,
      // 仅在启用 JWT 模式时才注入，避免与静态 token 混用
      getToken: useJwtAuth ? () => signMailGatewayToken(jwtSecret) : undefined,
      authHeader: normalizeString(gatewayAuthHeader) || normalizeString(env.MAIL_GATEWAY_AUTH_HEADER) || undefined,
      authValueTemplate:
        normalizeString(gatewayAuthTemplate) || normalizeString(env.MAIL_GATEWAY_AUTH_TEMPLATE) || undefined,
      fieldNames: {
        from: normalizeString(gatewayFromField) || undefined,
        to: normalizeString(gatewayToField) || undefined,
        subject: normalizeString(gatewaySubjectField) || undefined,
        text: normalizeString(gatewayTextField) || undefined,
        html: normalizeString(gatewayHtmlField) || undefined,
      },
      // 网关可以自己配置发件人，因此 from 允许为空
      from: from || undefined,
      timeoutMs: resolvedTimeout,
    });

    return {
      kind,
      registerEnabled: registerEnabled !== false,
      describe: provider.describe(),
      provider,
    };
  }

  // kind === 'smtp'
  const host = pick(smtpHost, env.SMTP_HOST);
  const username = pick(smtpUsername, env.SMTP_USERNAME);
  const password = pick(smtpPassword, env.SMTP_PASSWORD);
  const smtpFromAddress = pick(smtpFrom, env.SMTP_FROM) || pick(mailFrom, env.MAIL_FROM);

  if (!host || !username || !password || !smtpFromAddress) {
    return null;
  }

  const port = toPort(smtpPort, env.SMTP_PORT);
  const provider = createSmtpMailProvider({
    host,
    port,
    username,
    password,
    from: smtpFromAddress,
    fromName: normalizeString(smtpFromName) || undefined,
    tlsMode: normalizeTlsMode(smtpTlsMode),
    authMethod: normalizeAuthMethod(smtpAuthMethod),
  });

  return {
    kind,
    registerEnabled: registerEnabled !== false,
    describe: provider.describe(),
    provider,
  };
}

/**
 * 决定使用哪个 Provider。
 * 显式指定优先；否则按「有哪个配哪个」自动探测，全都没有才返回 null。
 */
function resolveProviderKind(input: {
  explicit: string;
  hasResend: boolean;
  hasGateway: boolean;
  hasSmtp: boolean;
}): MailProviderKind | null {
  if (input.explicit === 'smtp' || input.explicit === 'resend' || input.explicit === 'custom') {
    return input.explicit;
  }

  if (input.hasResend) return 'resend';
  if (input.hasGateway) return 'custom';
  if (input.hasSmtp) return 'smtp';

  return null;
}

/**
 * 发送注册验证码邮件。
 * 任何失败都转成 AUTH_EMAIL_SEND_FAILED，不向外暴露底层服务细节。
 */
export async function sendVerificationCode(
  config: ResolvedMailConfig,
  options: { to: string; code: string; siteName: string; expiresInMinutes: number },
): Promise<void> {
  const { to: recipient, code, siteName, expiresInMinutes } = options;

  const text = [
    `${siteName} 账户注册验证码`,
    "",
    `你的验证码是：${code}`,
    "",
    `验证码 ${expiresInMinutes} 分钟内有效，请尽快完成注册。`,
    "如果这不是你本人的操作，请忽略这封邮件。",
  ].join("\n");

  const html = `
    <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 480px;">
      <h2 style="margin: 0 0 16px;">${escapeHtml(siteName)} 账户注册验证码</h2>
      <p style="color: #555;">你的验证码是：</p>
      <p style="font-size: 32px; font-weight: 600; letter-spacing: 4px; margin: 16px 0;">
        ${escapeHtml(code)}
      </p>
      <p style="color: #777; font-size: 14px;">
        验证码 ${expiresInMinutes} 分钟内有效，请尽快完成注册。<br>
        如果这不是你本人的操作，请忽略这封邮件。
      </p>
    </div>
  `;

  try {
    await config.provider.send({
      to: recipient,
      subject: `${siteName} 注册验证码：${code}`,
      text,
      html,
    });
  } catch (error) {
    // 记录足够排查的信息，但绝不能把凭证写进日志（describe 不含敏感信息）。
    const detail = error instanceof MailDeliveryError
      ? `[${error.provider}] ${error.message}`
      : error instanceof Error
        ? error.message
        : String(error);

    console.error('[mail] failed to send verification email', {
      route: config.describe,
      detail,
      // 收件人域名：排查服务商是否拒收特定域名时有用
      recipientDomain: recipient.split('@')[1] ?? null,
    });

    throw bizError(
      AUTH_ERROR_CODES.AUTH_EMAIL_SEND_FAILED,
      'Failed to send verification email',
      502,
    );
  }
}

function pick(configValue: unknown, envValue: string | undefined): string {
  if (typeof configValue === 'string' && configValue.trim()) {
    return configValue.trim();
  }

  return envValue?.trim() ?? "";
}

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : "";
}

function normalizeTlsMode(value: unknown): 'implicit' | 'starttls' | undefined {
  const normalized = normalizeString(value).toLowerCase();
  if (normalized === 'implicit' || normalized === 'starttls') {
    return normalized;
  }
  // 兼容旧配置项 smtp.use_starttls
  if (normalized === 'true') return 'starttls';
  if (normalized === 'false') return 'starttls';
  return undefined;
}

function normalizeAuthMethod(value: unknown): 'login' | 'plain' | undefined {
  const normalized = normalizeString(value).toLowerCase();
  return normalized === 'plain' || normalized === 'login' ? normalized : undefined;
}

function toPort(configValue: unknown, envValue: string | undefined): number {
  const raw = pick(configValue, envValue);
  const parsed = parseInt(raw, 10);

  // 587 是 STARTTLS 的常用端口，也是最稳妥的默认值。
  // 465（隐式 TLS）由 resolveTlsMode 按端口自动识别。
  return Number.isFinite(parsed) && parsed > 0 && parsed < 65536 ? parsed : 587;
}

function toPositiveInt(value: unknown): number | undefined {
  const parsed = typeof value === 'number' ? value : parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// 重新导出，供测试与其他模块判断 TLS 模式
export { resolveTlsMode };
