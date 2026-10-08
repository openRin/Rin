import { describe, it, expect } from 'bun:test';
import { SignJWT } from 'jose';
import {
  MAIL_GATEWAY_AUDIENCE,
  MAIL_GATEWAY_PURPOSE,
  MAIL_TOKEN_TTL_SECONDS,
  resolveMailSigningSecret,
  signMailGatewayToken,
} from '../mail/token';

/**
 * 网关调用凭证的签发测试：主站签的 JWT 能被网关接受，
 * 用户登录 JWT 必须被拒绝（防止网关变成 spam 跳板）。
 */
describe('mail gateway token', () => {
    const secret = 'test-mail-jwt-secret';
    const key = new TextEncoder().encode(secret);

    /** 模拟网关侧的校验逻辑，与 docs/mail-gateway-worker.js 保持一致 */
    async function verifyLikeGateway(token: string, gatewaySecret: string) {
        const parts = token.split('.');
        if (parts.length !== 3) return { valid: false, reason: '格式错误' };

        const [headerPart, payloadPart, signaturePart] = parts;

        let header;
        let payload;
        try {
            header = JSON.parse(new TextDecoder().decode(toBytes(headerPart)));
            payload = JSON.parse(new TextDecoder().decode(toBytes(payloadPart)));
        } catch {
            return { valid: false, reason: '格式错误' };
        }

        if (header.alg !== 'HS256') return { valid: false, reason: '算法不支持' };

        const cryptoKey = await crypto.subtle.importKey(
            'raw',
            new TextEncoder().encode(gatewaySecret),
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['verify'],
        );
        const valid = await crypto.subtle.verify(
            'HMAC',
            cryptoKey,
            toBytes(signaturePart),
            new TextEncoder().encode(`${headerPart}.${payloadPart}`),
        );
        if (!valid) return { valid: false, reason: '签名无效' };

        const aud = payload.aud;
        const audList = Array.isArray(aud) ? aud : [aud];
        if (!audList.includes(MAIL_GATEWAY_AUDIENCE)) {
            return { valid: false, reason: '用途不匹配' };
        }
        if (payload.purpose !== MAIL_GATEWAY_PURPOSE) {
            return { valid: false, reason: '用途不匹配' };
        }

        const now = Math.floor(Date.now() / 1000);
        if (typeof payload.exp === 'number' && now >= payload.exp) {
            return { valid: false, reason: '已过期' };
        }

        return { valid: true };
    }

    function toBytes(value: string): Uint8Array<ArrayBuffer> {
        const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
        const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
        const binary = atob(padded);
        // 显式声明 ArrayBuffer：crypto.subtle.verify 要求 BufferSource，
        // 而 Uint8Array 的默认泛型会推成 ArrayBufferLike 而不兼容
        const bytes = new Uint8Array(new ArrayBuffer(binary.length));
        for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
        return bytes;
    }

    describe('signMailGatewayToken', () => {
        it('should return a token the gateway accepts', async () => {
            const token = await signMailGatewayToken(secret);
            expect(token).toBeTruthy();

            const result = await verifyLikeGateway(token!, secret);
            expect(result.valid).toBe(true);
        });

        it('should include the expected audience and purpose', async () => {
            const token = await signMailGatewayToken(secret);
            const payload = JSON.parse(new TextDecoder().decode(toBytes(token!.split('.')[1])));

            expect(payload.aud).toBe(MAIL_GATEWAY_AUDIENCE);
            expect(payload.purpose).toBe(MAIL_GATEWAY_PURPOSE);
        });

        it('should set a short expiry', async () => {
            const token = await signMailGatewayToken(secret);
            const payload = JSON.parse(new TextDecoder().decode(toBytes(token!.split('.')[1])));

            const ttl = payload.exp - payload.iat;
            expect(ttl).toBe(MAIL_TOKEN_TTL_SECONDS);
            // 明确断言这是个短期凭证，不给长期有效的窗口
            expect(ttl).toBeLessThanOrEqual(120);
        });

        it('should return null when no secret is available', async () => {
            // 密钥缺失时不签发，让网关拒绝请求，而不是发出无鉴权的请求
            const token = await signMailGatewayToken(null);
            expect(token).toBeNull();
        });

        it('should produce a different token each call', async () => {
            // iat 精度是秒，同秒内两次签发可能相同，因此只断言结构有效
            const a = await signMailGatewayToken(secret);
            const b = await signMailGatewayToken(secret);
            expect(a).toBeTruthy();
            expect(b).toBeTruthy();
            const result = await verifyLikeGateway(a!, secret);
            expect(result.valid).toBe(true);
            expect(result).toEqual(await verifyLikeGateway(b!, secret));
        });
    });

    describe('security: user login tokens must be rejected', () => {
        it('should reject a token without the mail audience', async () => {
            // 这正是主站用户登录 JWT 的形态：有 id，但无 aud / purpose
            const userToken = await new SignJWT({ id: 1, username: 'attacker' })
                .setProtectedHeader({ alg: 'HS256' })
                .setIssuedAt()
                .setExpirationTime(Math.floor(Date.now() / 1000) + 3600)
                .sign(key);

            const result = await verifyLikeGateway(userToken, secret);
            expect(result.valid).toBe(false);
            expect(result.reason).toContain('用途不匹配');
        });

        it('should reject a token missing the purpose claim', async () => {
            // 即使 aud 正确，缺 purpose 也应拒绝（双保险）
            const token = await new SignJWT({})
                .setProtectedHeader({ alg: 'HS256' })
                .setIssuedAt()
                .setExpirationTime(Math.floor(Date.now() / 1000) + 60)
                .setAudience(MAIL_GATEWAY_AUDIENCE)
                .sign(key);

            const result = await verifyLikeGateway(token, secret);
            expect(result.valid).toBe(false);
        });

        it('should reject a token with a different purpose', async () => {
            const token = await new SignJWT({ purpose: 'something-else' })
                .setProtectedHeader({ alg: 'HS256' })
                .setIssuedAt()
                .setExpirationTime(Math.floor(Date.now() / 1000) + 60)
                .setAudience(MAIL_GATEWAY_AUDIENCE)
                .sign(key);

            const result = await verifyLikeGateway(token, secret);
            expect(result.valid).toBe(false);
        });

        it('should reject an expired token', async () => {
            const token = await new SignJWT({ purpose: MAIL_GATEWAY_PURPOSE })
                .setProtectedHeader({ alg: 'HS256' })
                .setIssuedAt(Math.floor(Date.now() / 1000) - 600)
                .setExpirationTime(Math.floor(Date.now() / 1000) - 300)
                .setAudience(MAIL_GATEWAY_AUDIENCE)
                .sign(key);

            const result = await verifyLikeGateway(token, secret);
            expect(result.valid).toBe(false);
            expect(result.reason).toContain('过期');
        });

        it('should reject a token signed with a different secret', async () => {
            const token = await signMailGatewayToken('a-completely-different-secret');

            const result = await verifyLikeGateway(token!, secret);
            expect(result.valid).toBe(false);
            expect(result.reason).toBe('签名无效');
        });

        it('should reject an alg:none token', async () => {
            // 算法混淆攻击：伪造一个不带签名的 JWT
            const header = toBase64Url(JSON.stringify({ alg: 'none' }));
            const payload = toBase64Url(JSON.stringify({
              aud: MAIL_GATEWAY_AUDIENCE,
              purpose: MAIL_GATEWAY_PURPOSE,
              exp: Math.floor(Date.now() / 1000) + 3600,
            }));
            const forged = `${header}.${payload}.`;

            const result = await verifyLikeGateway(forged, secret);
            expect(result.valid).toBe(false);
        });

        function toBase64Url(value: string) {
            return btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
        }
    });

    describe('resolveMailSigningSecret', () => {
        it('should prefer a dedicated mail secret', () => {
            const env = { MAIL_JWT_SECRET: 'dedicated', JWT_SECRET: 'main' } as Env;
            expect(resolveMailSigningSecret(env)).toBe('dedicated');
        });

        it('should fall back to the main JWT secret', () => {
            const env = { JWT_SECRET: 'main' } as Env;
            expect(resolveMailSigningSecret(env)).toBe('main');
        });

        it('should return null when neither is set', () => {
            expect(resolveMailSigningSecret({} as Env)).toBeNull();
        });

        it('should ignore a blank dedicated secret', () => {
            // 空白字符串会让签名密钥退化成弱值，必须当作未配置
            const env = { MAIL_JWT_SECRET: '   ', JWT_SECRET: 'main' } as Env;
            expect(resolveMailSigningSecret(env)).toBe('main');
        });
    });
});
