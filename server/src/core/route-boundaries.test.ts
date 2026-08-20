import { describe, expect, it } from "bun:test";
import { t } from "@rin/api";
import { Hono } from "hono";
import type { Variables } from "./hono-types";
import { adminOnly, userOnly, withJsonBody } from "./route-boundaries";

function createApp(admin = false, uid?: number) {
    const app = new Hono<{ Bindings: Env; Variables: Variables }>();
    app.use('*', async (c, next) => {
        c.set('admin', admin);
        c.set('uid', uid);
        await next();
    });
    return app;
}

describe('route boundaries', () => {
    it('preserves configured admin denial responses', async () => {
        const app = createApp();
        app.get('/text', adminOnly(async (c) => c.text('ok')));
        app.get('/json', adminOnly(async (c) => c.text('ok'), { format: 'json' }));

        const textResponse = await app.request('/text');
        expect(textResponse.status).toBe(401);
        expect(await textResponse.text()).toBe('Unauthorized');

        const jsonResponse = await app.request('/json');
        expect(jsonResponse.status).toBe(401);
        expect(await jsonResponse.json() as unknown).toEqual({ error: 'Unauthorized' });
    });

    it('passes an authenticated user id to the route handler', async () => {
        const app = createApp(false, 42);
        app.get('/', userOnly(async (c, uid) => c.json({ uid })));

        const response = await app.request('/');
        expect(response.status).toBe(200);
        expect(await response.json() as unknown).toEqual({ uid: 42 });
    });

    it('validates JSON before invoking a handler', async () => {
        const app = createApp(true, 1);
        const schema = t.Object({ title: t.String() });
        app.post('/', withJsonBody<{ title: string }>(schema, async (c, body) => c.json(body)));

        const invalid = await app.request('/', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ title: 3 }),
        });
        expect(invalid.status).toBe(400);
        expect(await invalid.text()).toBe('title must be a string');

        const malformed = await app.request('/', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: '{',
        });
        expect(malformed.status).toBe(400);
        expect(await malformed.text()).toBe('Invalid JSON body');

        const valid = await app.request('/', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ title: 'Rin' }),
        });
        expect(valid.status).toBe(200);
        expect(await valid.json() as unknown).toEqual({ title: 'Rin' });
    });
});
