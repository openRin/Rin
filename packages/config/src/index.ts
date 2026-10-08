import type { AIConfig } from "@rin/api";

export const WEBHOOK_URL_KEY = "WEBHOOK_URL";

export const CLIENT_CONFIG_DEFAULTS = new Map(
  Object.entries({
    "cache.enabled": false,
    "counter.enabled": true,
    "friend_apply_enable": true,
    "header.behavior": "fixed",
    "header.layout": "classic",
    "feed.layout": "list",
    "feed.card_variant": "default",
    "theme.color": "#fc466b",
    "comment.enabled": true,
    "login.enabled": true,
    "site.name": "Rin",
    "site.description": "A lightweight personal blogging system",
    "site.avatar": "",
    "site.page_size": 5,
  }),
);

export const SERVER_CONFIG_DEFAULTS = new Map(
  Object.entries({
    friend_apply_auto_accept: false,
    friend_crontab: true,
    friend_ua: "Rin-Check/0.1.0",
    "webhook.method": "POST",
    "webhook.content_type": "application/json",
    "webhook.headers": "{}",
    "webhook.body_template": "{\"content\":\"{{message}}\"}",
    // 游客评论是否需要人工审核后才对外可见。
    "comment.moderate_guest": true,
    // 登录用户评论是否也要审核（默认 true）。
    // 开了人机验证说明确实有人在刷，登录只证明是个真实账号。
    // 想让登录用户免审可设为 false。
    "comment.moderate_user": true,
    // 邮箱注册总开关。与「邮件服务是否配置完整」是两个独立维度：
    // 配好了邮件但想临时关掉注册时，改这个即可。
    "register.enabled": true,
  }),
);

export const CLIENT_CONFIG_ENV_DEFAULTS: Record<string, string> = {
  "site.name": "NAME",
  "site.description": "DESCRIPTION",
  "site.avatar": "AVATAR",
  "site.page_size": "PAGE_SIZE",
};

export const AI_CONFIG_PREFIX = "ai_summary.";

export const AI_CONFIG_KEYS = [
  `${AI_CONFIG_PREFIX}enabled`,
  `${AI_CONFIG_PREFIX}provider`,
  `${AI_CONFIG_PREFIX}model`,
  `${AI_CONFIG_PREFIX}api_key`,
  `${AI_CONFIG_PREFIX}api_url`,
] as const;

/**
 * 通过 config API 下发时需要打码的敏感字段。
 * 邮件相关凭证一旦泄漏，攻击者就能冒名发信或重置用户密码。
 */
export const SENSITIVE_SERVER_CONFIG_FIELDS = [
  `${AI_CONFIG_PREFIX}api_key`,
  "smtp.password",
  "turnstile.secret_key",
  "resend.api_key",
  "mail.gateway_token",
] as const;

export const DEFAULT_AI_CONFIG: AIConfig = {
  enabled: false,
  provider: "openai",
  model: "gpt-4o-mini",
  api_key: "",
  api_url: "https://api.openai.com/v1",
};

export class ConfigWrapper {
  config: Record<string, unknown>;
  defaultConfig: Map<string, unknown>;

  constructor(config: Record<string, unknown>, defaultConfig: Map<string, unknown>) {
    this.config = config;
    this.defaultConfig = defaultConfig;
  }

  get<T>(key: string) {
    const value = this.config[key];
    if (value !== undefined && value !== "") {
      return value as T;
    }
    if (this.defaultConfig.has(key)) {
      return this.defaultConfig.get(key) as T;
    }
    return undefined;
  }

  default<T>(key: string) {
    return this.defaultConfig.get(key) as T;
  }

  getBoolean(key: string) {
    const value = this.get<unknown>(key);

    if (typeof value === "boolean") {
      return value;
    }

    if (typeof value === "string") {
      const normalizedValue = value.trim().toLowerCase();

      if (normalizedValue === "true") {
        return true;
      }

      if (normalizedValue === "false") {
        return false;
      }
    }

    if (typeof value === "number") {
      return value !== 0;
    }

    return Boolean(value);
  }
}
