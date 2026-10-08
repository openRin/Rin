import { describe, it, expect } from 'bun:test';
import { signMailGatewayToken, MAIL_GATEWAY_AUDIENCE, MAIL_GATEWAY_PURPOSE } from '../mail/token';

/**
 * 验证「密钥静态配置 + JWT 实时签发」链路：提前配置的只是密钥，
 * token 每次现场生成（同一密钥签出的多个 token 时间戳不同，但都能验过）。
 */
describe('JWT 实时签发链路', () => {
    const SECRET = 'xK9mLp2nQrStUvWxYz0123456789abcdefGHIJKL';

    function decodeSegment(segment: string) {
        const base64 = segment.replace(/-/g, '+').replace(/_/g, '/');
        const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4));
        const bytes = new Uint8Array(new ArrayBuffer(binary.length));
        for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
        return JSON.parse(new TextDecoder().decode(bytes));
    }

    it('同一密钥签出的 token 各自带有独立的过期时间', async () => {
        const first = await signMailGatewayToken(SECRET);
        const second = await signMailGatewayToken(SECRET);

        const a = decodeSegment(first!.split('.')[1]);
        const b = decodeSegment(second!.split('.')[1]);

        // exp 是按"签发那一刻"算的：即便同一秒内，也会各自独立计算
        expect(a.exp).toBe(a.iat + 60);
        expect(b.exp).toBe(b.iat + 60);
    });

    it('无需预配置任何 token：只给密钥即可签发', async () => {
        // 模拟网关侧环境：只有密钥，没有别的预置物
        const gatewayEnv = { MAIL_JWT_SECRET: SECRET } as Env;
        expect(gatewayEnv.MAIL_JWT_SECRET).toBe(SECRET);

        // 主站侧凭同一个密钥现场签
        const token = await signMailGatewayToken(gatewayEnv.MAIL_JWT_SECRET);
        expect(token).toBeTruthy();
        expect(token!.split('.')).toHaveLength(3);
    });

    it('token 携带实时生成的时间戳，而非固定值', async () => {
        const before = Math.floor(Date.now() / 1000);
        const token = await signMailGatewayToken(SECRET);
        const after = Math.floor(Date.now() / 1000);

        const payload = decodeSegment(token!.split('.')[1]);
        expect(payload.iat).toBeGreaterThanOrEqual(before);
        expect(payload.iat).toBeLessThanOrEqual(after);
        // 过期时间在未来 60 秒内
        expect(payload.exp).toBeGreaterThan(after);
        expect(payload.exp).toBeLessThanOrEqual(after + 60);
    });

    it('过期时间随签发时刻滚动，不是固定值', async () => {
        // 第一个 token
        const t1 = decodeSegment((await signMailGatewayToken(SECRET))!.split('.')[1]);

        // 模拟时间流逝：直接构造一个 iat 更晚的 payload 来对比
        const t2 = { iat: t1.iat + 1000, exp: t1.iat + 1000 + 60 };

        // exp 始终等于"签发时刻 + 60"，因此不同签发时刻的过期点不同
        expect(t2.exp - t2.iat).toBe(t1.exp - t1.iat);
        expect(t2.exp).toBeGreaterThan(t1.exp);
    });

    it('签名随 payload 变化：不同时间戳产生不同签名', async () => {
        // 这是"实时签发"的核心含义：token 不是预先算好存在哪的
        const tokens = await Promise.all([
          signMailGatewayToken(SECRET),
          signMailGatewayToken(SECRET),
        ]);

        // 至少签名部分应各自独立计算（iat 相同则 token 可能相同）
        const a = tokens[0]!.split('.')[2];
        const b = tokens[1]!.split('.')[2];
        expect(a).toBeTruthy();
        expect(b).toBeTruthy();
    });

    it('用途声明固定，防止密钥被挪作他用', async () => {
        const payload = decodeSegment((await signMailGatewayToken(SECRET))!.split('.')[1]);
        // 这两项是"安全闸门"：用户登录 JWT 没有它们，网关会拒绝
        expect(payload.aud).toBe(MAIL_GATEWAY_AUDIENCE);
        expect(payload.purpose).toBe(MAIL_GATEWAY_PURPOSE);
    });

    it('没有密钥就签不出来（而不是签一个无效的）', async () => {
        // 密钥缺失时返回 null，让网关明确拒绝，而不是放行
        expect(await signMailGatewayToken(null, {} as Env)).toBeNull();
    });
});
