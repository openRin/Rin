import { t } from "i18next";
import { API_ERROR_CODES } from "@rin/api";

/**
 * 把后端业务错误码翻译成用户可读文案；分支依据是稳定的 code 而非易变的 message。
 * 未知 code 兜底为 `error.value`（服务端文案），再兜底为通用错误提示。
 */
export function apiErrorText(
  error: { value: string; code?: string } | undefined,
  fallbackKey = "apiError.unknown",
): string {
  if (!error) {
    return t(fallbackKey);
  }

  if (error.code && error.code in API_ERROR_CODES) {
    // 只对已知错误码查 i18n；缺失翻译时 i18next 会回退到 key，
    // 此时再退回服务端文案，避免用户看到 "apiError.XXX" 这种裸 key。
    const translated = t(`apiError.${error.code}`);
    if (translated && translated !== `apiError.${error.code}`) {
      return translated;
    }
  }

  return error.value || t(fallbackKey);
}

/**
 * 判断错误码是否属于人机验证类，用于决定是否需要重置 Turnstile widget。
 */
export function isCaptchaError(error: { code?: string } | undefined): boolean {
  return (
    error?.code === API_ERROR_CODES.CAPTCHA_FAILED ||
    error?.code === API_ERROR_CODES.CAPTCHA_REQUIRED
  );
}

/** 判断错误码是否属于「凭证过期」类（验证码失效应退回注册第一步） */
export function isExpiredCodeError(error: { code?: string } | undefined): boolean {
  return error?.code === API_ERROR_CODES.AUTH_CODE_INVALID;
}
