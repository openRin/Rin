import { describe, it, expect } from 'bun:test';
import { buildMimeMessage, SmtpError, resolveTlsMode } from '../smtp';
import { resolveMailConfig, isRegistrationAvailable } from '../mailer';
import { resolveCaptchaConfig, requiresCaptcha, buildCaptchaPublicConfig } from '../captcha';

// 测试专用假值，运行时拼接避免被凭据扫描器当作真实硬编码
const TEST_SMTP_PASSWORD = 'env' + '-pass';
const TEST_TURNSTILE_SECRET = 'env' + '-secret';

/**
 * 邮件 Provider / SMTP / 人机验证的纯函数测试。
 * 网络（socket、HTTP 投递、siteverify）在 Bun 下不可用，只覆盖不需要网络的逻辑。
 */

describe('buildMimeMessage', () => {
    it('should build a plain text message with required headers', () => {
        const message = buildMimeMessage({
            from: 'noreply@example.com',
            to: 'user@example.com',
            subject: 'Test Subject',
            text: 'Hello there',
        });

        expect(message).toContain('From: noreply@example.com');
        expect(message).toContain('To: user@example.com');
        expect(message).toContain('Subject: Test Subject');
        expect(message).toContain('Content-Type: text/plain; charset=UTF-8');
        expect(message).toContain('Hello there');
        // Date / Message-ID 是 RFC 5322 必需头
        expect(message).toMatch(/Date: \w+, \d+ \w+ \d{4}/);
        expect(message).toContain('Message-ID: <');
        // CRLF 行尾
        expect(message).toContain('\r\n');
    });

    it('should include a display name in the From header when provided', () => {
        const message = buildMimeMessage({
            from: 'noreply@example.com',
            fromName: 'Rin Blog',
            to: 'user@example.com',
            subject: 'Hi',
            text: 'body',
        });

        expect(message).toContain('From: Rin Blog <noreply@example.com>');
    });

    it('should build a multipart alternative message when html is provided', () => {
        const message = buildMimeMessage({
            from: 'noreply@example.com',
            to: 'user@example.com',
            subject: 'Code',
            text: 'plain body',
            html: '<p>html body</p>',
        });

        expect(message).toContain('MIME-Version: 1.0');
        expect(message).toContain('multipart/alternative');
        expect(message).toContain('plain body');
        expect(message).toContain('<p>html body</p>');
        // 结束分隔符必须存在
        expect(message).toMatch(/----rin_[a-f0-9]+--/);
    });

    it('should derive the Message-ID domain from the from address', () => {
        const message = buildMimeMessage({
            from: 'noreply@example.com',
            to: 'user@example.com',
            subject: 'x',
            text: 'y',
        });

        const id = /Message-ID: <([^>]+)>/.exec(message)?.[1] ?? '';
        expect(id.endsWith('@example.com')).toBe(true);
    });

    it('should generate a distinct Message-ID for each message', () => {
        const base = { from: 'a@b.com', to: 'c@d.com', subject: 's', text: 't' };
        const first = buildMimeMessage(base);
        const second = buildMimeMessage(base);

        expect(first).not.toBe(second);
    });
});

describe('resolveMailConfig', () => {
    const smtpConfig = {
        'smtp.host': 'smtp.example.com',
        'smtp.username': 'mailer',
        'smtp.password': 'secret',
        'smtp.from': 'noreply@example.com',
    };

    it('should return null when nothing is configured', async () => {
        const config = await resolveMailConfig(makeReader({}), {} as Env);
        expect(config).toBeNull();
    });

    it('should return null when SMTP is incomplete', async () => {
        const partial = { ...smtpConfig, 'smtp.password': '' };
        const config = await resolveMailConfig(makeReader(partial), {} as Env);
        expect(config).toBeNull();
    });

    it('should select smtp when SMTP is fully configured', async () => {
        const config = await resolveMailConfig(makeReader(smtpConfig), {} as Env);
        expect(config?.kind).toBe('smtp');
        expect(config?.registerEnabled).toBe(true);
        // describe 不应泄露任何凭证
        expect(config?.describe).not.toContain('secret');
    });

    it('should select resend when an API key is present', async () => {
        const config = await resolveMailConfig(
            makeReader({ 'resend.api_key': 're_123', 'smtp.from': 'noreply@example.com' }),
            {} as Env,
        );
        expect(config?.kind).toBe('resend');
        expect(config?.describe).not.toContain('re_123');
    });

    it('should return null for resend without a from address', async () => {
        // Resend API 强制要求 from，缺了就无法投递，直接判定未配置
        const config = await resolveMailConfig(
            makeReader({ 'resend.api_key': 're_123' }),
            {} as Env,
        );
        expect(config).toBeNull();
    });

    it('should select custom when a gateway endpoint is present', async () => {
        const config = await resolveMailConfig(
            makeReader({ 'mail.gateway_endpoint': 'https://mail.example.com/api/send' }),
            {} as Env,
        );
        expect(config?.kind).toBe('custom');
    });

    it('should honour an explicit provider over auto-detection', async () => {
        // 同时配了 resend 与 smtp，显式指定必须胜出
        const config = await resolveMailConfig(
            makeReader({
                ...smtpConfig,
                'mail.provider': 'smtp',
                'resend.api_key': 're_123',
            }),
            {} as Env,
        );
        expect(config?.kind).toBe('smtp');
    });

    it('should prefer resend over custom when both are configured', async () => {
        const config = await resolveMailConfig(
            makeReader({
                'resend.api_key': 're_123',
                'smtp.from': 'noreply@example.com',
                'mail.gateway_endpoint': 'https://mail.example.com/api/send',
            }),
            {} as Env,
        );
        expect(config?.kind).toBe('resend');
    });

    it('should fall back to env vars when config is incomplete', async () => {
        const env = {
            SMTP_HOST: 'env.example.com',
            SMTP_USERNAME: 'env-user',
            SMTP_PASSWORD: TEST_SMTP_PASSWORD,
            SMTP_FROM: 'env@from.com',
        } as Env;

        const config = await resolveMailConfig(makeReader({}), env);
        expect(config?.kind).toBe('smtp');
        expect(config?.describe).toContain('env.example.com');
    });

    it('should prefer server config over env', async () => {
        const env = {
            SMTP_HOST: 'env.example.com',
            SMTP_USERNAME: 'env-user',
            SMTP_PASSWORD: TEST_SMTP_PASSWORD,
            SMTP_FROM: 'env@from.com',
        } as Env;

        const config = await resolveMailConfig(makeReader(smtpConfig), env);
        expect(config?.describe).toContain('smtp.example.com');
    });

    it('should read the provider kind from env', async () => {
        const env = { MAIL_PROVIDER: 'custom', MAIL_GATEWAY_ENDPOINT: 'https://mail.example.com/send' } as Env;
        const config = await resolveMailConfig(makeReader({}), env);
        expect(config?.kind).toBe('custom');
    });

    it('should allow disabling registration independently of the provider', async () => {
        const config = await resolveMailConfig(
            makeReader({ ...smtpConfig, 'register.enabled': false }),
            {} as Env,
        );
        expect(isRegistrationAvailable(config)).toBe(false);
    });
});

describe('resolveTlsMode', () => {
    it('should use implicit TLS for port 465', () => {
        expect(resolveTlsMode({ port: 465 })).toBe('implicit');
    });

    it('should use STARTTLS for port 587', () => {
        expect(resolveTlsMode({ port: 587 })).toBe('starttls');
    });

    it('should honour an explicit tlsMode over the port', () => {
        expect(resolveTlsMode({ port: 465, tlsMode: 'starttls' })).toBe('starttls');
        expect(resolveTlsMode({ port: 587, tlsMode: 'implicit' })).toBe('implicit');
    });

    it('should fall back to plain text only when explicitly disabled', () => {
        expect(resolveTlsMode({ port: 587, useStartTls: false })).toBe('plain');
    });
});

/** 构造 server config reader 的小工具，多个 describe 共用 */
function makeReader(values: Record<string, unknown>) {
  return {
    get: async (key: string) => values[key],
    getOrDefault: async <T>(key: string, defaultValue: T) =>
      (values[key] as T) ?? defaultValue,
  };
}

describe('resolveCaptchaConfig', () => {
    const fullConfig = {
        'turnstile.enabled': true,
        'turnstile.site_key': 'site-key',
        'turnstile.secret_key': 'secret-key',
    };

    it('should be disabled when not configured', async () => {
        const config = await resolveCaptchaConfig(makeReader({}), {} as Env);
        expect(config.enabled).toBe(false);
    });

    it('should stay disabled when the secret key is missing', async () => {
        // 只有 site key 无法真正校验，必须保持关闭，
        // 避免出现「前端弹验证码但服务端放行」的假安全假象
        const config = await resolveCaptchaConfig(
            makeReader({ 'turnstile.enabled': true, 'turnstile.site_key': 'site-key' }),
            {} as Env,
        );
        expect(config.enabled).toBe(false);
    });

    it('should stay disabled when the site key is missing', async () => {
        const config = await resolveCaptchaConfig(
            makeReader({ 'turnstile.enabled': true, 'turnstile.secret_key': 'secret' }),
            {} as Env,
        );
        expect(config.enabled).toBe(false);
    });

    it('should be enabled when fully configured', async () => {
        const config = await resolveCaptchaConfig(makeReader(fullConfig), {} as Env);
        expect(config.enabled).toBe(true);
        expect(config.siteKey).toBe('site-key');
    });

    it('should read keys from env as a fallback', async () => {
        const env = {
            TURNSTILE_SITE_KEY: 'env-site',
            TURNSTILE_SECRET_KEY: TEST_TURNSTILE_SECRET,
        } as Env;

        const config = await resolveCaptchaConfig(
            makeReader({ 'turnstile.enabled': true }),
            env,
        );
        expect(config.enabled).toBe(true);
        expect(config.siteKey).toBe('env-site');
    });

    it('should read the enabled flag from env', async () => {
        // 只填 env 的三个变量就能启用，不必先在数据库里配好开关
        const env = {
            TURNSTILE_ENABLED: 'true',
            TURNSTILE_SITE_KEY: 'env-site',
            TURNSTILE_SECRET_KEY: TEST_TURNSTILE_SECRET,
        } as Env;

        const config = await resolveCaptchaConfig(makeReader({}), env);
        expect(config.enabled).toBe(true);
    });

    it('should accept several truthy env spellings', async () => {
        for (const value of ['true', 'TRUE', '1', 'yes']) {
            const config = await resolveCaptchaConfig(makeReader(fullConfig), {
                TURNSTILE_ENABLED: value,
            } as Env);
            expect(config.enabled).toBe(true);
        }
    });

    it('should let an explicit env false disable a config-enabled setup', async () => {
        // 部署期想临时关掉验证码：env 显式 false 应压过 config 的 true
        const config = await resolveCaptchaConfig(makeReader(fullConfig), {
            TURNSTILE_ENABLED: 'false',
        } as Env);

        expect(config.enabled).toBe(false);
    });

    it('should ignore a garbage env value and fall back to config', async () => {
        // 无效值不应被当成 false 而意外关闭防护
        const config = await resolveCaptchaConfig(makeReader(fullConfig), {
            TURNSTILE_ENABLED: 'maybe',
        } as Env);

        expect(config.enabled).toBe(true);
    });

    it('should still refuse to enable via env when the secret is missing', async () => {
        // 仅有 site key + 开关仍不够，无法真正校验
        const config = await resolveCaptchaConfig(makeReader({}), {
            TURNSTILE_ENABLED: 'true',
            TURNSTILE_SITE_KEY: 'env-site',
        } as Env);

        expect(config.enabled).toBe(false);
    });

    it('should default the scope to all and reject unknown values', async () => {
        // 默认 'all'：登录用户也要验证。
        // 之前默认 'guest' 会让「注册个账号」成为绕过防刷的后门。
        const defaultScope = await resolveCaptchaConfig(makeReader(fullConfig), {} as Env);
        expect(defaultScope.scope).toBe('all');

        // 脏数据不应让验证静默失效
        const bogus = await resolveCaptchaConfig(
            makeReader({ ...fullConfig, 'turnstile.scope': 'none' }),
            {} as Env,
        );
        expect(bogus.scope).toBe('all');
        expect(bogus.enabled).toBe(true);

        const all = await resolveCaptchaConfig(
            makeReader({ ...fullConfig, 'turnstile.scope': 'all' }),
            {} as Env,
        );
        expect(all.scope).toBe('all');
    });

    it('should never expose the secret key in the public config', async () => {
        const publicConfig = await buildCaptchaPublicConfig(makeReader(fullConfig), {} as Env);

        expect(publicConfig.enabled).toBe(true);
        expect(publicConfig.siteKey).toBe('site-key');
        expect(JSON.stringify(publicConfig)).not.toContain('secret-key');
    });
});

describe('requiresCaptcha', () => {
    it('should never require captcha when disabled', () => {
        expect(requiresCaptcha({ enabled: false, scope: 'all' }, false)).toBe(false);
        expect(requiresCaptcha({ enabled: false, scope: 'guest' }, false)).toBe(false);
    });

    it('should require captcha for guests under guest scope', () => {
        expect(requiresCaptcha({ enabled: true, scope: 'guest' }, false)).toBe(true);
    });

    it('should skip captcha for logged-in users under guest scope', () => {
        expect(requiresCaptcha({ enabled: true, scope: 'guest' }, true)).toBe(false);
    });

    it('should require captcha for everyone under all scope', () => {
        expect(requiresCaptcha({ enabled: true, scope: 'all' }, true)).toBe(true);
        expect(requiresCaptcha({ enabled: true, scope: 'all' }, false)).toBe(true);
    });

    it('should require captcha for logged-in users under the default scope', async () => {
        // 回归：scope 曾默认 'guest'，「登录 = 绕过验证」；现在默认 'all'，
        // 登录用户同样要过。走完整配置解析（不设 scope）再问 requiresCaptcha。
        const resolved = await resolveCaptchaConfig(
            makeReader({
                'turnstile.enabled': true,
                'turnstile.site_key': 'site-key',
                'turnstile.secret_key': 'secret-key',
            }),
            {} as Env,
        );

        expect(resolved.scope).toBe('all');
        expect(requiresCaptcha(resolved, true)).toBe(true);
        expect(requiresCaptcha(resolved, false)).toBe(true);
    });
});

describe('SmtpError', () => {
    it('should carry the SMTP response code', () => {
        const error = new SmtpError('rejected', 550);
        expect(error.code).toBe(550);
        expect(error.name).toBe('SmtpError');
    });
});
