import { SignJWT } from 'jose';

/**
 * 主 Worker → 邮件网关的调用凭证：签发用途受限、60 秒过期的短期 JWT。
 * 不共享主站 JWT_SECRET（否则用户登录 token 可当发信凭证，密钥泄露即两个系统被攻破），
 * 也不用静态 token（无法限定"仅主站可发信"）。
 * `aud`/`purpose` 双重限定用途，网关侧只需共享独立的 `MAIL_JWT_SECRET`。
 */

/** 网关的 audience 标识；网关侧会严格校验这个值 */
export const MAIL_GATEWAY_AUDIENCE = 'rin-mail-gateway';

/** purpose 声明，进一步限定 token 用途 */
export const MAIL_GATEWAY_PURPOSE = 'mail-gateway';

/** token 有效期（秒）。发信是一次性动作，不需要长有效期 */
export const MAIL_TOKEN_TTL_SECONDS = 60;

function toKey(secret: string | Uint8Array): Uint8Array {
  return typeof secret === 'string' ? new TextEncoder().encode(secret) : secret;
}

/**
 * 解析用于签发网关 token 的密钥。
 * 优先 `MAIL_JWT_SECRET`（推荐，独立密钥，权限边界最小）；
 * 未配置时回落到主站 `JWT_SECRET` 以兼容「零额外配置」的场景。
 */
export function resolveMailSigningSecret(env: Env): string | null {
  const dedicated = env.MAIL_JWT_SECRET?.trim();
  if (dedicated) {
    return dedicated;
  }

  const fallback = env.JWT_SECRET?.trim();
  return fallback || null;
}

/**
 * 签发一个调用邮件网关的短期 JWT。
 *
 * @param secret 签名密钥；留空则自动从 env 解析
 * @returns JWT 字符串；密钥缺失时返回 null（调用方应跳过签名，让网关拒绝请求）
 */
export async function signMailGatewayToken(
  secret: string | null | undefined,
  env?: Env,
): Promise<string | null> {
  const key = secret ?? (env ? resolveMailSigningSecret(env) : null);

  if (!key) {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);

  return new SignJWT({ purpose: MAIL_GATEWAY_PURPOSE })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(now)
    .setExpirationTime(now + MAIL_TOKEN_TTL_SECONDS)
    .setAudience(MAIL_GATEWAY_AUDIENCE)
    .sign(toKey(key));
}
