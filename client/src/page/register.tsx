import { useEffect, useRef, useState } from "react";
import { t } from "i18next";
import { useLocation } from "wouter";
import type { CaptchaConfig } from "@rin/api";
import { ButtonWithLoading } from "../components/button";
import { Input } from "../components/input";
import { TurnstileWidget, resetTurnstile } from "../components/turnstile";
import { client } from "../app/runtime";
import { setAuthToken } from "../utils/auth";
import { getLoginRedirectPath } from "../utils/auth-redirect";
import { apiErrorText, isCaptchaError, isExpiredCodeError } from "../utils/api-error";

/**
 * 邮箱注册页：两步式验证码流程（request 发码 → verify 建号并登录）。
 * 服务端只在验证码通过后建号，未验证邮箱无法产生可登录账号。
 */
export function RegisterPage() {
  const [step, setStep] = useState<'request' | 'verify'>('request');

  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');

  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const [captchaToken, setCaptchaToken] = useState('');
  const [captchaConfig, setCaptchaConfig] = useState<CaptchaConfig>();
  const [captchaBroken, setCaptchaBroken] = useState(false);
  const [captchaConfigLoadFailed, setCaptchaConfigLoadFailed] = useState(false);
  const captchaRef = useRef<HTMLDivElement | null>(null);

  const [, setLocation] = useLocation();

  useEffect(() => {
    client.comment.captchaConfig().then(({ data, error: apiError }) => {
      if (data) {
        setCaptchaConfig(data);
        return;
      }
      // 配置拉取失败时不能静默当作「不需要验证」—— 服务端可能开着验证，
      // 前端却没有 widget，用户会卡在无法提交的状态。
      console.error('[register] failed to load captcha config', apiError?.value ?? apiError);
      setCaptchaConfigLoadFailed(true);
    });
  }, []);

  // 开启后要求所有人验证（注册必然是未登录状态）
  // captchaConfig 尚未到达前保持 loading，避免短暂渲染成「无需验证」
  const needsCaptcha = Boolean(captchaConfig?.enabled && captchaConfig.siteKey);
  const captchaLoading = captchaConfig === undefined && !captchaConfigLoadFailed;

  // 重发冷却倒计时，避免用户狂点申请接口
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const handleRequest = async () => {
    if (isLoading) return;

    if (!email.trim() || !username.trim() || !password) {
      setError(t('register.error.empty'));
      return;
    }

    // 前端先挡一道：没有 token 就直接提示，不浪费一次请求。
    // 服务端仍会独立校验，前端这层只是体验。
    if (needsCaptcha && !captchaToken) {
      setError(
        captchaBroken
          ? t('register.error.captcha_broken')
          : t('register.error.captcha_required'),
      );
      return;
    }
    setIsLoading(true);
    setError('');

    try {
      const { error: apiError, data } = await client.auth.registerRequest({
        email: email.trim(),
        username: username.trim(),
        password,
        ...(captchaToken ? { captchaToken } : {}),
      });

      if (apiError) {
        setError(apiErrorText(apiError));
        if (isCaptchaError(apiError)) {
          setCaptchaToken('');
          resetTurnstile(captchaRef.current);
        }
        return;
      }

      setCooldown(data?.cooldownSeconds ?? 60);
      setStep('verify');
      setNotice(t('register.code_sent'));
    } catch {
      setError(t('register.error.network'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify = async () => {
    if (isLoading) return;

    if (code.trim().length !== 6) {
      setError(t('register.error.code_length'));
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const { error: apiError, data } = await client.auth.registerVerify({
        email: email.trim(),
        code: code.trim(),
      });

      if (apiError) {
        setError(apiErrorText(apiError));
        // 验证码失效或用尽次数时退回第一步，让用户重新申请
        if (isExpiredCodeError(apiError)) {
          setStep('request');
        }
        return;
      }

      if (data?.token) {
        setAuthToken(data.token);
      }
      setLocation(getLoginRedirectPath(window.location.search));
      window.location.reload();
    } catch {
      setError(t('register.error.network'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center my-8">
      <div className="bg-w w-full max-w-md flex flex-col items-center justify-between p-8 space-y-4 t-primary rounded-2xl shadow-lg">
        <p className="text-2xl font-bold">{t('register.title')}</p>

        {error && <p className="text-sm text-red-500">{error}</p>}
        {notice && !error && <p className="text-sm text-green-500">{notice}</p>}

        {step === 'request' ? (
          <>
            <Input
              value={email}
              setValue={setEmail}
              placeholder={t('register.email.placeholder')}
              type="email"
              disabled={isLoading}
              autofocus
            />
            <Input
              value={username}
              setValue={setUsername}
              placeholder={t('register.username.placeholder')}
              disabled={isLoading}
            />
            <Input
              value={password}
              setValue={setPassword}
              placeholder={t('register.password.placeholder')}
              type="password"
              onSubmit={handleRequest}
              disabled={isLoading}
            />

            {captchaConfigLoadFailed && (
              <p className="text-sm text-red-500 self-start">
                {t('register.error.captcha_config_failed')}
              </p>
            )}

            {!captchaConfigLoadFailed && captchaLoading && (
              <p className="text-sm text-neutral-500 self-start">
                {t('register.loading_captcha')}
              </p>
            )}

            {needsCaptcha && (
              <div ref={captchaRef} className="self-start">
                <TurnstileWidget
                  siteKey={captchaConfig!.siteKey}
                  action="register"
                  onToken={setCaptchaToken}
                  onExpire={() => setCaptchaToken('')}
                  onError={() => {
                    // 区分「组件加载失败」与「验证未完成」：
                    // 前者是用户无能为力的问题，要给出可操作的提示
                    setCaptchaToken('');
                    setCaptchaBroken(true);
                  }}
                />
              </div>
            )}

            <div className="flex flex-row items-center space-x-4 pt-2 w-full">
              <ButtonWithLoading
                title={isLoading ? t('register.sending') : t('register.request_code')}
                onClick={handleRequest}
                loading={isLoading}
              />
              <button
                className="text-sm t-secondary hover:underline"
                onClick={() => setLocation('/login')}
              >
                {t('register.back_to_login')}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm t-secondary self-start">
              {t('register.code_sent_to', { email: email.trim() })}
            </p>
            <Input
              value={code}
              setValue={setCode}
              placeholder={t('register.code.placeholder')}
              disabled={isLoading}
              autofocus
              onSubmit={handleVerify}
            />

            <div className="flex flex-row items-center space-x-4 pt-2 w-full">
              <ButtonWithLoading
                title={isLoading ? t('register.verifying') : t('register.verify')}
                onClick={handleVerify}
                loading={isLoading}
              />
              <button
                className="text-sm t-secondary hover:underline disabled:opacity-50"
                disabled={cooldown > 0 || isLoading}
                onClick={() => setStep('request')}
              >
                {cooldown > 0
                  ? t('register.resend_in', { seconds: cooldown })
                  : t('register.change_email')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
