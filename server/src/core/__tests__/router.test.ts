import { describe, it, expect, beforeEach } from 'bun:test';
import { createMockEnv } from '../../../tests/fixtures';
import { createBaseApp } from '../base';
import type { Context, Handler } from '../types';

describe('Router', () => {
    let app: ReturnType<typeof createBaseApp>;
    let env: Env;

    beforeEach(() => {
        env = createMockEnv();
        app = createBaseApp(env);
    });

    describe('Basic routing', () => {
        it('should handle GET requests', async () => {
            const handler: Handler = () => 'GET response';
            app.get('/test', handler);
            
            const request = new Request('http://localhost/test');
            const response = await app.handle(request, env);
            
            expect(response.status).toBe(200);
            expect(await response.json() as string).toBe('GET response');
        });

        it('should handle POST requests', async () => {
            const handler: Handler = () => 'POST response';
            app.post('/test', handler);
            
            const request = new Request('http://localhost/test', { method: 'POST' });
            const response = await app.handle(request, env);
            
            expect(response.status).toBe(200);
            expect(await response.json() as string).toBe('POST response');
        });

        it('should handle PUT requests', async () => {
            const handler: Handler = () => 'PUT response';
            app.put('/test', handler);
            
            const request = new Request('http://localhost/test', { method: 'PUT' });
            const response = await app.handle(request, env);
            
            expect(response.status).toBe(200);
        });

        it('should handle DELETE requests', async () => {
            const handler: Handler = () => 'DELETE response';
            app.delete('/test', handler);
            
            const request = new Request('http://localhost/test', { method: 'DELETE' });
            const response = await app.handle(request, env);
            
            expect(response.status).toBe(200);
        });
    });

    describe('Route parameters', () => {
        it('should extract route parameters', async () => {
            const handler: Handler = (ctx: Context) => ({ id: ctx.params.id });
            app.get('/users/:id', handler);
            
            const request = new Request('http://localhost/users/123');
            const response = await app.handle(request, env);
            
            expect(response.status).toBe(200);
            const data = await response.json() as any;
            expect(data.id).toBe('123');
        });

        it('should handle multiple parameters', async () => {
            const handler: Handler = (ctx: Context) => ({
                userId: ctx.params.userId,
                postId: ctx.params.postId
            });
            app.get('/users/:userId/posts/:postId', handler);
            
            const request = new Request('http://localhost/users/1/posts/2');
            const response = await app.handle(request, env);
            
            expect(response.status).toBe(200);
            const data = await response.json() as any;
            expect(data.userId).toBe('1');
            expect(data.postId).toBe('2');
        });
    });

    describe('Query parameters', () => {
        it('should parse query string', async () => {
            const handler: Handler = (ctx: Context) => ctx.query;
            app.get('/search', handler);
            
            const request = new Request('http://localhost/search?q=test&page=1');
            const response = await app.handle(request, env);
            
            expect(response.status).toBe(200);
            const data = await response.json() as any;
            expect(data.q).toBe('test');
            expect(data.page).toBe('1');
        });

        it('should handle empty query', async () => {
            const handler: Handler = (ctx: Context) => ctx.query;
            app.get('/test', handler);
            
            const request = new Request('http://localhost/test');
            const response = await app.handle(request, env);
            
            expect(response.status).toBe(200);
            const data = await response.json() as any;
            expect(Object.keys(data).length).toBe(0);
        });
    });

    describe('Route groups', () => {
        it('should handle grouped routes', async () => {
            app.group('/api', (group) => {
                group.get('/users', () => 'users list' as any);
                group.get('/posts', () => 'posts list' as any);
            });
            
            const request1 = new Request('http://localhost/api/users');
            const response1 = await app.handle(request1, env);
            expect(response1.status).toBe(200);
            expect(await response1.json() as string).toBe('users list');
            
            const request2 = new Request('http://localhost/api/posts');
            const response2 = await app.handle(request2, env);
            expect(response2.status).toBe(200);
            expect(await response2.json() as string).toBe('posts list');
        });

        it('should handle nested groups', async () => {
            app.group('/api', (api) => {
                api.group('/v1', (v1) => {
                    v1.get('/test', () => 'v1 test' as any);
                });
            });
            
            const request = new Request('http://localhost/api/v1/test');
            const response = await app.handle(request, env);
            
            expect(response.status).toBe(200);
            expect(await response.json() as string).toBe('v1 test');
        });
    });

    describe('Middleware', () => {
        it('should run middleware before handler', async () => {
            let middlewareRan = false;
            
            app.use(async (ctx: Context, _env: Env) => {
                middlewareRan = true;
                ctx.store.testValue = 'from middleware';
            });
            
            const handler: Handler = (ctx: Context) => ({ value: ctx.store.testValue });
            app.get('/test', handler);
            
            const request = new Request('http://localhost/test');
            const response = await app.handle(request, env);
            
            expect(middlewareRan).toBe(true);
            expect(response.status).toBe(200);
        });

        it('should allow middleware to return early response', async () => {
            app.use(async () => {
                return new Response('Blocked by middleware', { status: 403 });
            });
            
            const handler: Handler = () => 'should not reach here';
            app.get('/test', handler);
            
            const request = new Request('http://localhost/test');
            const response = await app.handle(request, env);
            
            expect(response.status).toBe(403);
            expect(await response.text()).toBe('Blocked by middleware');
        });
    });

    describe('Error handling', () => {
        it('should return 404 for unknown routes', async () => {
            const request = new Request('http://localhost/unknown');
            const response = await app.handle(request, env);
            
            expect(response.status).toBe(404);
        });

        it('should handle handler errors', async () => {
            const handler: Handler = () => {
                throw new Error('Test error');
            };
            app.get('/error', handler);
            
            const request = new Request('http://localhost/error');
            const response = await app.handle(request, env);
            
            expect(response.status).toBe(500);
        });
    });

    describe('CORS', () => {
        it('should handle OPTIONS preflight', async () => {
            const request = new Request('http://localhost/test', { method: 'OPTIONS' });
            const response = await app.handle(request, env);
            
            expect(response.status).toBe(204);
            expect(response.headers.get('Access-Control-Allow-Origin')).toBeDefined();
            expect(response.headers.get('Access-Control-Allow-Methods')).toContain('GET');
        });
    });
});
