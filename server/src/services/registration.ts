import {
  AUTH_ERROR_CODES,
  registerRequestSchema,
  registerVerifySchema,
  validateSchema,
  type RegisterRequest,
  type RegisterResponse,
} from "@rin/api";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import type { AppContext } from "../core/hono-types";
import { profileAsync } from "../core/server-timing";
import { setJWTCookie } from "../core/hono-middleware";
import { users } from "../db/schema";
import { bizError, validationErrorFromIssues } from "../errors";
import { verifyCaptchaToken } from "./captcha";
import { isRegistrationAvailable, resolveMailConfig, sendVerificationCode } from "./mailer";

/**
 * 邮箱注册：两步式验证码流程。
 *   POST /auth/register/request → 校验可用性，发 6 位验证码，不建号
 *   POST /auth/register/verify  → 校验验证码，建号，签发 JWT
 * 分两步是因为未验证的邮箱不应产生可登录账号。
 */

/** 验证码有效期（分钟） */
const CODE_TTL_MINUTES = 10;
/** 同一邮箱重发冷却时间（秒） */
const RESEND_COOLDOWN_SECONDS = 60;
/** 验证码最大尝试次数，超过即作废 */
const MAX_VERIFY_ATTEMPTS = 5;

const CODE_CACHE_PREFIX = "auth:register:code:";
const RATE_LIMIT_CACHE_PREFIX = "auth:register:cooldown:";

/** 存进 cache 的验证码记录 */
type StoredCode = {
  code: string;
  username: string;
  /** 已哈希的密码，绝不存明文 */
  passwordHash: string;
  expiresAt: number;
  attempts: number;
};

export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function generateCode(): string {
  // crypto.getRandomValues 保证随机性，Math.random 在这里不够用
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte % 10).join("");
}

/**
 * key 的短哈希片段，用于诊断日志：能对上存/查的 key 又不泄露邮箱原文。
 * 用 FNV-1a 而非 SHA-256：只需区分 key，且 SHA-256 是异步的，诊断路径不好用。
 */
function hashKeyFragment(key: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < key.length; i += 1) {
    hash ^= key.charCodeAt(i);
    // 乘 16777619，用 Math.imul 保持 32 位整数精度
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

export function RegistrationService(): Hono {
  const app = new Hono();

  /**
   * 读取注册所需的全部配置。任一环缺失都返回 null，前端据此隐藏注册入口。
   */
  async function loadRegistrationConfig(c: AppContext) {
    const serverConfig = c.get('serverConfig');
    const env = c.get('env');
    const mail = await resolveMailConfig(serverConfig, env);

    return {
      available: isRegistrationAvailable(mail),
      mail,
      siteName: (await serverConfig.getOrDefault<string>("site.name", "Rin")) || "Rin",
    };
  }

  // POST /auth/register/request - 发送注册验证码
  app.post('/register/request', async (c: AppContext) => {
    const db = c.get('db');
    const cache = c.get('cache');
    const serverConfig = c.get('serverConfig');
    const env = c.get('env');

    const { available, mail, siteName } = await loadRegistrationConfig(c);

    if (!available || !mail) {
      throw bizError(
        AUTH_ERROR_CODES.AUTH_REGISTER_DISABLED,
        'Email registration is not enabled',
        403,
      );
    }

    // 契约校验：schema 与 @rin/api 共享，服务端不再手写字段判断
    const body = await profileAsync(c, 'register_request_parse', () => c.req.json()) as RegisterRequest;
    const validation = validateSchema<RegisterRequest>(registerRequestSchema, body);

    if (!validation.success) {
      const emailIssue = validation.issues.find((issue) => issue.path === 'email');
      throw validationErrorFromIssues(
        emailIssue ? AUTH_ERROR_CODES.AUTH_EMAIL_INVALID : AUTH_ERROR_CODES.AUTH_EMAIL_INVALID,
        emailIssue ? 'Invalid email address' : 'Invalid registration payload',
        validation.issues,
      );
    }

    const email = normalizeEmail(validation.data.email);
    const { username, password } = validation.data;

    // 人机验证：与评论共用同一套 Turnstile 配置，scope 仍按是否登录判断（此处必然未登录）
    await profileAsync(c, 'register_captcha', () => verifyCaptchaToken({
      serverConfig,
      env,
      isLoggedIn: false,
      captchaToken: validation.data.captchaToken,
      expectedAction: 'register',
    }));

    // 重发冷却：防止被用来轰炸某个邮箱
    const cooldownKey = `${RATE_LIMIT_CACHE_PREFIX}${email}`;
    const now = Date.now();
    const cooldownUntil = await cache.get(cooldownKey) as number | null;
    if (typeof cooldownUntil === 'number' && cooldownUntil > now) {
      const waitSeconds = Math.ceil((cooldownUntil - now) / 1000);
      throw bizError(
        AUTH_ERROR_CODES.AUTH_CODE_TOO_FREQUENT,
        `Please wait ${waitSeconds}s before requesting another code`,
        429,
      );
    }

    // 可用性检查放在发信之前：邮箱已被占用就没必要浪费一次发信额度
    const emailTaken = await profileAsync(c, 'register_email_lookup', () => db.query.users.findFirst({
      where: eq(users.email, email),
    }));
    if (emailTaken) {
      throw bizError(AUTH_ERROR_CODES.AUTH_EMAIL_TAKEN, 'Email is already registered', 409);
    }

    const usernameTaken = await profileAsync(c, 'register_username_lookup', () => db.query.users.findFirst({
      where: eq(users.username, username),
    }));
    if (usernameTaken) {
      throw bizError(AUTH_ERROR_CODES.AUTH_USERNAME_TAKEN, 'Username is already taken', 409);
    }

    const code = generateCode();
    const record: StoredCode = {
      code,
      username,
      passwordHash: await hashPassword(password),
      expiresAt: now + CODE_TTL_MINUTES * 60 * 1000,
      attempts: 0,
    };

    await cache.set(`${CODE_CACHE_PREFIX}${email}`, record, true);
    await cache.set(cooldownKey, now + RESEND_COOLDOWN_SECONDS * 1000, true);

    // 发信失败不回滚验证码记录：用户可能只是网络抖动，重试即可。
    // 真正的可枚举风险由"始终返回相同响应"来防，而不是靠回滚。
    await sendVerificationCode(mail, {
      to: email,
      code,
      siteName,
      expiresInMinutes: CODE_TTL_MINUTES,
    });

    return c.json({
      success: true,
      // 只告知有效期，不回传验证码本身
      expiresInSeconds: CODE_TTL_MINUTES * 60,
      cooldownSeconds: RESEND_COOLDOWN_SECONDS,
    });
  });

  // POST /auth/register/verify - 校验验证码并创建账号
  app.post('/register/verify', async (c: AppContext) => {
    const db = c.get('db');
    const cache = c.get('cache');
    const jwt = c.get('jwt');
    const serverConfig = c.get('serverConfig');

    const { available } = await loadRegistrationConfig(c);
    if (!available) {
      throw bizError(
        AUTH_ERROR_CODES.AUTH_REGISTER_DISABLED,
        'Email registration is not enabled',
        403,
      );
    }

    const body = await profileAsync(c, 'register_verify_parse', () => c.req.json());

    // 先 trim 再校验：用户复制验证码常带肉眼不可见的空格/换行，
    // 会让 6 位变 7 位被 schema 拦下。清洗必须在 schema 之前才生效。
    const normalizedBody = {
      ...body,
      code: typeof body.code === 'string' ? body.code.trim() : body.code,
    };

    const validation = validateSchema<{ email: string; code: string }>(registerVerifySchema, normalizedBody);

    if (!validation.success) {
      throw validationErrorFromIssues(
        AUTH_ERROR_CODES.AUTH_CODE_INVALID,
        'Invalid verification code payload',
        validation.issues,
      );
    }

    const email = normalizeEmail(validation.data.email);
    const codeKey = `${CODE_CACHE_PREFIX}${email}`;
    const record = await cache.get(codeKey) as StoredCode | null;

    if (!record) {
      // 诊断日志：区分「没查到记录」（存储问题）与「内容不匹配」（复制带了空格等）。
      // 只记录 key 哈希片段，不打邮箱原文。
      console.warn('[register] verification code not found', {
        keyHash: hashKeyFragment(codeKey),
        inputCodeLength: validation.data.code.length,
        inputCodeHasWhitespace: /\s/.test(validation.data.code),
      });

      throw bizError(
        AUTH_ERROR_CODES.AUTH_CODE_INVALID,
        'Verification code is invalid or has expired',
        400,
      );
    }

    // 输入侧再 trim 一次，防用户复制带空格导致匹配不上
    const normalizedInput = validation.data.code.trim();

    console.warn('[register] verifying code', {
      keyHash: hashKeyFragment(codeKey),
      inputLength: normalizedInput.length,
      inputHasWhitespace: /\s/.test(validation.data.code),
      storedLength: record.code.length,
      // 只说是否匹配，不打出验证码本身
      lengthMatches: normalizedInput.length === record.code.length,
    });

    // 无论成败都消费掉这条记录：一次性凭证。
    // 成功后建号，失败后也要删，否则可以无限次爆破。
    await cache.delete(codeKey);

    if (record.expiresAt < Date.now()) {
      throw bizError(
        AUTH_ERROR_CODES.AUTH_CODE_INVALID,
        'Verification code has expired',
        400,
      );
    }

    if (record.attempts >= MAX_VERIFY_ATTEMPTS) {
      throw bizError(
        AUTH_ERROR_CODES.AUTH_CODE_INVALID,
        'Too many verification attempts, please request a new code',
        429,
      );
    }

    if (record.code !== normalizedInput) {
      // 尝试次数用完前保留记录，让用户还能继续输剩下的次数
      const attempts = record.attempts + 1;
      if (attempts < MAX_VERIFY_ATTEMPTS) {
        await cache.set(codeKey, { ...record, attempts }, true);
      }
      throw bizError(
        AUTH_ERROR_CODES.AUTH_CODE_INVALID,
        'Verification code is incorrect',
        400,
      );
    }

    // 到这一步验证码已通过。仍然要复查占用情况：
    // 申请验证码到提交验证之间可能已经有人抢注。
    const [existingEmail, existingUsername] = await profileAsync(c, 'register_verify_conflict', () =>
      Promise.all([
        db.query.users.findFirst({ where: eq(users.email, email) }),
        db.query.users.findFirst({ where: eq(users.username, record.username) }),
      ]),
    );

    if (existingEmail) {
      throw bizError(AUTH_ERROR_CODES.AUTH_EMAIL_TAKEN, 'Email is already registered', 409);
    }

    if (existingUsername) {
      throw bizError(AUTH_ERROR_CODES.AUTH_USERNAME_TAKEN, 'Username is already taken', 409);
    }

    // openid 对邮箱账号没有 OAuth 身份，用 `email:` 前缀保证与 GitHub 账号不冲突
    const inserted = await profileAsync(c, 'register_verify_insert', () => db.insert(users).values({
      username: record.username,
      openid: `email:${email}`,
      avatar: "",
      password: record.passwordHash,
      permission: 0,
      email,
      emailVerified: 1,
    }).returning({ id: users.id, username: users.username, avatar: users.avatar, permission: users.permission }));

    const user = inserted?.[0];
    if (!user) {
      throw bizError(AUTH_ERROR_CODES.AUTH_EMAIL_INVALID, 'Failed to create account', 500);
    }

    const token = await profileAsync(c, 'register_verify_token', () => jwt.sign({ id: user.id }));
    setJWTCookie(c, token);

    // 与 GitHub 登录保持一致：额外写一个非 HttpOnly cookie 供前端读取，
    // 供跨域场景使用（httpOnly cookie 跨域拿不到）。
    const { setCookie } = await import('hono/cookie');
    setCookie(c, 'auth_token', token, {
      expires: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
      path: '/',
      sameSite: 'Lax',
    });

    const response: RegisterResponse = {
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        avatar: user.avatar,
        permission: user.permission === 1,
      },
    };

    return c.json(response);
  });

  return app;
}

/**
 * 供 auth/status 复用：注册是否可用。
 * 单独导出避免在 auth 服务里重复实现配置解析。
 */
export async function checkRegistrationAvailable(
  serverConfig: { get: (key: string) => Promise<any>; getOrDefault: <T>(key: string, defaultValue: T) => Promise<T> },
  env: Env,
): Promise<boolean> {
  return isRegistrationAvailable(await resolveMailConfig(serverConfig, env));
}
