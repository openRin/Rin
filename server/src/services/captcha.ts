import { COMMENT_ERROR_CODES, type CaptchaConfig } from "@rin/api";
import { bizError } from "../errors";

/**
 * Cloudflare Turnstile 人机验证。
 * 可选：未配置 secret key 时降级为不校验；服务端永远独立校验 token（前端渲染只是体验）；
 * scope：`all` 所有人验证，`guest` 仅未登录用户。
 */

const SITEVERIFY_ENDPOINT = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

type TurnstileSiteverifyResponse = {
  success: boolean;
  "error-codes"?: string[];
  action?: string;
  cdata?: string;
  hostname?: string;
};

export type CaptchaConfigReader = {
  get(key: string): Promise<unknown>;
  getOrDefault<T>(key: string, defaultValue: T): Promise<T>;
};

export type CaptchaScope = CaptchaConfig["scope"];

/**
 * Turnstile 的 site key / secret key 存放位置：
 * `secret_key` 走 server config（敏感），site key 优先读 env（公开信息，便于多环境共用）。
 */
export async function resolveCaptchaConfig(
  serverConfig: CaptchaConfigReader,
  env: Env,
): Promise<{ enabled: boolean; scope: CaptchaScope; siteKey: string; secretKey: string }> {
  const [enabledFromConfig, scope, secretKey, siteKeyFromConfig] = await Promise.all([
    serverConfig.getOrDefault<boolean>("turnstile.enabled", false),
    serverConfig.get("turnstile.scope"),
    serverConfig.get("turnstile.secret_key"),
    serverConfig.get("turnstile.site_key"),
  ]);

  // 开关有两条来源：server config（后台可改）优先，env 作为部署期默认值。
  // 两者都没开时保持关闭 —— 未配置 secret key 的话也无法真正校验。
  const enabledFromEnv = parseBoolean(env.TURNSTILE_ENABLED);
  const enabled = enabledFromEnv ?? enabledFromConfig;

  const secret = normalizeString(secretKey) || normalizeString(env.TURNSTILE_SECRET_KEY);
  const siteKey = normalizeString(siteKeyFromConfig) || normalizeString(env.TURNSTILE_SITE_KEY);

  // scope 默认 'all'：只接受受支持的值，其他（含脏数据）一律回落，防登录用户绕过验证
  const normalizedScope: CaptchaScope =
    scope === "all" || scope === "guest" ? scope : "all";

  // 没有 secret key 时强制关闭，避免"前端弹验证码但服务端放行"的假安全
  const effectiveEnabled = Boolean(enabled) && Boolean(secret) && Boolean(siteKey);

  return {
    enabled: effectiveEnabled,
    scope: normalizedScope,
    siteKey: siteKey || "",
    secretKey: secret || "",
  };
}

/**
 * 下发给前端的公开配置。**绝不包含 secretKey。**
 */
export async function buildCaptchaPublicConfig(
  serverConfig: CaptchaConfigReader,
  env: Env,
): Promise<CaptchaConfig> {
  const config = await resolveCaptchaConfig(serverConfig, env);
  return {
    enabled: config.enabled,
    scope: config.scope,
    siteKey: config.siteKey,
  };
}

/**
 * 判断当前请求是否需要通过人机验证。
 */
export function requiresCaptcha(
  config: { enabled: boolean; scope: CaptchaScope },
  isLoggedIn: boolean,
): boolean {
  if (!config.enabled) {
    return false;
  }

  return config.scope === "all" || !isLoggedIn;
}

type VerifyOptions = {
  serverConfig: CaptchaConfigReader;
  env: Env;
  isLoggedIn: boolean;
  captchaToken?: string;
  /** 期望的 action 名，便于 Cloudflare 后台按用途区分统计 */
  expectedAction?: string;
  /** 期望的 hostname；不校验则传 undefined */
  expectedHostname?: string;
  /** 用户来源 IP，透传给 Cloudflare 提升判定准确度 */
  remoteIp?: string;
};

/**
 * 校验 Turnstile token。未触发校验条件时直接返回，不产生网络请求。
 *
 * 校验失败统一抛 CAPTCHA_FAILED，不向外透出 Cloudflare 的具体错误码，
 * 避免给攻击者反馈信号。
 */
export async function verifyCaptchaToken(options: VerifyOptions): Promise<void> {
  const { serverConfig, env, isLoggedIn, captchaToken, expectedAction } = options;

  const config = await resolveCaptchaConfig(serverConfig, env);

  if (!requiresCaptcha(config, isLoggedIn)) {
    return;
  }

  const token = normalizeString(captchaToken);
  if (!token) {
    throw bizError(
      COMMENT_ERROR_CODES.CAPTCHA_REQUIRED,
      "Captcha verification is required",
      400,
    );
  }

  const formData = new FormData();
  formData.append("secret", config.secretKey);
  formData.append("response", token);
  if (expectedAction) {
    formData.append("action", expectedAction);
  }
  // 传入用户 IP 与 UA 有助于 Cloudflare 判定 token 与环境是否一致。
  // 拿不到就跳过，不影响主流程。
  const remoteIp = options.remoteIp;
  if (remoteIp) {
    formData.append("remoteip", remoteIp);
  }
  let result: TurnstileSiteverifyResponse;
  try {
    const response = await fetch(SITEVERIFY_ENDPOINT, {
      method: "POST",
      body: formData,
    });
    result = (await response.json()) as TurnstileSiteverifyResponse;
  } catch (error) {
    // 网络故障不等于验证失败，但也不能放行，否则验证码形同虚设。
    throw bizError(
      COMMENT_ERROR_CODES.CAPTCHA_FAILED,
      "Captcha verification service is unavailable",
      503,
    );
  }

  if (!result.success) {
    // Cloudflare 的 error-codes 对排查至关重要，但不能透给客户端（给攻击者反馈信号），
    // 只记服务端日志，对外统一报 CAPTCHA_FAILED。
    console.error('[captcha] siteverify rejected the token', {
      'error-codes': result['error-codes'] ?? [],
      hostname: result.hostname ?? null,
      action: result.action ?? null,
    });

    throw bizError(
      COMMENT_ERROR_CODES.CAPTCHA_FAILED,
      "Captcha verification failed",
      400,
    );
  }

  if (expectedAction && result.action && result.action !== expectedAction) {
    // token 有效但用途不符，说明可能跨场景重放。
    console.error('[captcha] action mismatch', {
      expected: expectedAction,
      actual: result.action,
    });

    throw bizError(
      COMMENT_ERROR_CODES.CAPTCHA_FAILED,
      "Captcha action mismatch",
      400,
    );
  }
}

function normalizeString(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim();
}

/**
 * 宽松解析布尔 env 值。
 * 返回 undefined 表示「未设置」，让调用方能区分"没填"和"显式填了 false"——
 * 这对 config 与 env 的优先级判断很关键。
 */
function parseBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "true" || normalized === "1" || normalized === "yes") {
    return true;
  }
  if (normalized === "false" || normalized === "0" || normalized === "no") {
    return false;
  }

  return undefined;
}
