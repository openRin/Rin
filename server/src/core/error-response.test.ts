import { describe, expect, it } from "bun:test";
import { Hono } from "hono";
import { ValidationError } from "../errors";
import type { Variables } from "./hono-types";
import { registerErrorHandlers } from "./error-response";

describe('registerErrorHandlers', () => {
    it('serializes the canonical AppError response shape', async () => {
        const app = new Hono<{ Bindings: Env; Variables: Variables }>();
        app.get('/validation', () => {
            throw new ValidationError('Invalid title', [{ field: 'title', message: 'Title is required' }]);
        });
        registerErrorHandlers(app);

        const response = await app.request('/validation');
        expect(response.status).toBe(400);
        expect(await response.json() as unknown).toEqual({
            success: false,
            error: {
                code: 'VALIDATION_ERROR',
                message: 'Invalid title',
                details: [{ field: 'title', message: 'Title is required' }],
            },
        });
    });

    it('uses the same structured shape for unmatched routes', async () => {
        const app = new Hono<{ Bindings: Env; Variables: Variables }>();
        registerErrorHandlers(app);

        const response = await app.request('/missing');
        expect(response.status).toBe(404);
        expect(await response.json() as unknown).toEqual({
            success: false,
            error: {
                code: 'NOT_FOUND',
                message: 'Route GET /missing not found',
            },
        });
    });
});
