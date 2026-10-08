import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { createHttpMailProvider, createResendProvider } from '../mail/http';
import { MailDeliveryError } from '../mail/types';

/**
 * HTTP 邮件 Provider 测试：重点覆盖请求体与鉴权头的拼装、字段名映射、失败报错。
 * fetch 用 stub 替换，不发真实请求。
 */
describe('HTTP mail provider', () => {
    const originalFetch = globalThis.fetch;
    let calls: { url: string; init: RequestInit }[] = [];
    let nextResponse: () => Response = () => new Response('{}', { status: 200 });

    beforeEach(() => {
        calls = [];
        nextResponse = () => new Response('{}', { status: 200 });
        globalThis.fetch = (async (url: string | URL | Request, init: RequestInit = {}) => {
            calls.push({ url: String(url), init });
            return nextResponse();
        }) as typeof fetch;
    });

    afterEach(() => {
        globalThis.fetch = originalFetch;
    });

    const message = {
        to: 'user@example.com',
        subject: 'Your code',
        text: 'Code: 123456',
        html: '<p>Code: 123456</p>',
    };

    describe('request shape', () => {
        it('should POST JSON with default field names', async () => {
            const provider = createHttpMailProvider({
                kind: 'custom',
                endpoint: 'https://mail.example.com/api/send',
            });

            await provider.send(message);

            expect(calls).toHaveLength(1);
            expect(calls[0].url).toBe('https://mail.example.com/api/send');
            expect(calls[0].init.method).toBe('POST');

            const headers = calls[0].init.headers as Record<string, string>;
            expect(headers['Content-Type']).toBe('application/json');

            const body = JSON.parse(String(calls[0].init.body));
            expect(body.to).toBe('user@example.com');
            expect(body.subject).toBe('Your code');
            expect(body.text).toBe('Code: 123456');
            expect(body.html).toBe('<p>Code: 123456</p>');
        });

        it('should send Bearer auth by default', async () => {
            const provider = createHttpMailProvider({
                kind: 'custom',
                endpoint: 'https://mail.example.com/api/send',
                token: 'secret-token',
            });

            await provider.send(message);

            const headers = calls[0].init.headers as Record<string, string>;
            expect(headers.Authorization).toBe('Bearer secret-token');
        });

        it('should support a custom auth header and value template', async () => {
            // 对接用 X-Mail-Token 的网关
            const provider = createHttpMailProvider({
                kind: 'custom',
                endpoint: 'https://mail.example.com/api/send',
                token: 'secret-token',
                authHeader: 'X-Mail-Token',
                authValueTemplate: '{token}',
            });

            await provider.send(message);

            const headers = calls[0].init.headers as Record<string, string>;
            expect(headers['X-Mail-Token']).toBe('secret-token');
            expect(headers.Authorization).toBeUndefined();
        });

        it('should support custom body field names', async () => {
            const provider = createHttpMailProvider({
                kind: 'custom',
                endpoint: 'https://mail.example.com/api/send',
                fieldNames: {
                    to: 'recipient',
                    subject: 'title',
                    text: 'content',
                    html: 'contentHtml',
                    from: 'sender',
                },
                from: 'noreply@example.com',
            });

            await provider.send(message);

            const body = JSON.parse(String(calls[0].init.body));
            expect(body.recipient).toBe('user@example.com');
            expect(body.title).toBe('Your code');
            expect(body.content).toBe('Code: 123456');
            expect(body.contentHtml).toBe('<p>Code: 123456</p>');
            expect(body.sender).toBe('noreply@example.com');
        });

        it('should omit html when only text is provided', async () => {
            const provider = createHttpMailProvider({
                kind: 'custom',
                endpoint: 'https://mail.example.com/api/send',
            });

            await provider.send({ to: 'a@b.com', subject: 's', text: 't' });

            const body = JSON.parse(String(calls[0].init.body));
            expect(body.text).toBe('t');
            expect(body.html).toBeUndefined();
        });

        it('should not send an Authorization header when no token is configured', async () => {
            const provider = createHttpMailProvider({
                kind: 'custom',
                endpoint: 'https://mail.example.com/api/send',
            });

            await provider.send(message);

            const headers = calls[0].init.headers as Record<string, string>;
            expect(headers.Authorization).toBeUndefined();
        });
    });

    describe('resend provider', () => {
        it('should default to the official endpoint with Bearer auth', async () => {
            const provider = createResendProvider({
                apiKey: 're_123',
                from: 'noreply@example.com',
            });

            await provider.send(message);

            expect(calls[0].url).toBe('https://api.resend.com/emails');
            const headers = calls[0].init.headers as Record<string, string>;
            expect(headers.Authorization).toBe('Bearer re_123');

            const body = JSON.parse(String(calls[0].init.body));
            expect(body.from).toBe('noreply@example.com');
            expect(body.to).toBe('user@example.com');
        });

        it('should support a custom endpoint for Resend-compatible gateways', async () => {
            const provider = createResendProvider({
                apiKey: 're_123',
                from: 'noreply@example.com',
                endpoint: 'https://proxy.example.com/resend',
            });

            await provider.send(message);
            expect(calls[0].url).toBe('https://proxy.example.com/resend');
        });
    });

    describe('failure handling', () => {
        it('should throw MailDeliveryError on a non-2xx response', async () => {
            nextResponse = () => new Response('rate limited', { status: 429 });

            const provider = createHttpMailProvider({
                kind: 'custom',
                endpoint: 'https://mail.example.com/api/send',
            });

            const error = await provider.send(message).catch((e) => e);
            expect(error).toBeInstanceOf(MailDeliveryError);
            expect(error.provider).toBe('custom');
            expect(error.status).toBe(429);
            expect(error.message).toContain('429');
        });

        it('should treat a 200 response with ok:false as a failure', async () => {
            // 某些网关用 200 携带业务错误，只看 HTTP 状态码会漏判
            nextResponse = () => new Response(JSON.stringify({ ok: false, error: 'invalid recipient' }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });

            const provider = createHttpMailProvider({
                kind: 'custom',
                endpoint: 'https://mail.example.com/api/send',
            });

            const error = await provider.send(message).catch((e) => e);
            expect(error).toBeInstanceOf(MailDeliveryError);
            expect(error.message).toContain('invalid recipient');
        });

        it('should accept a 200 response with ok:true', async () => {
            nextResponse = () => new Response(JSON.stringify({ ok: true }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });

            const provider = createHttpMailProvider({
                kind: 'custom',
                endpoint: 'https://mail.example.com/api/send',
            });

            await expect(provider.send(message)).resolves.toBeUndefined();
        });

        it('should report a network failure as MailDeliveryError', async () => {
            globalThis.fetch = (async () => {
                throw new TypeError('fetch failed');
            }) as typeof fetch;

            const provider = createHttpMailProvider({
                kind: 'custom',
                endpoint: 'https://mail.example.com/api/send',
            });

            const error = await provider.send(message).catch((e) => e);
            expect(error).toBeInstanceOf(MailDeliveryError);
            expect(error.message).toContain('Failed to reach mail gateway');
        });

        it('should reject when the endpoint is missing', async () => {
            const provider = createHttpMailProvider({ kind: 'custom', endpoint: '' });

            const error = await provider.send(message).catch((e) => e);
            expect(error).toBeInstanceOf(MailDeliveryError);
            expect(error.message).toContain('endpoint is not configured');
        });

        it('should truncate a long error body so logs stay readable', async () => {
            nextResponse = () => new Response('x'.repeat(5000), { status: 500 });

            const provider = createHttpMailProvider({
                kind: 'custom',
                endpoint: 'https://mail.example.com/api/send',
            });

            const error = await provider.send(message).catch((e) => e);
            expect(error.message.length).toBeLessThan(300);
        });
    });

    describe('describe()', () => {
        it('should not leak the token', () => {
            const provider = createHttpMailProvider({
                kind: 'custom',
                endpoint: 'https://mail.example.com/api/send',
                token: 'super-secret',
            });

            expect(provider.describe()).not.toContain('super-secret');
            expect(provider.describe()).toContain('mail.example.com');
        });
    });
});
