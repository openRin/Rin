import { createBaseApp } from "./core/base";
import { Router } from "./core/router";
import { getFirstPathSegment } from './utils/path';

// Service registry with lazy-loaded handlers
// Each route handler is a function that loads the actual service on first call

export function createApp(env: Env, path: string): Router | null {
    const group = getFirstPathSegment(path);
    const app = createBaseApp(env);
    
    switch (group) {
        case 'ai-config':
            app.group('/ai-config', (group) => {
                group.get('/', async (ctx) => {
                    const { AIConfigService } = await import('./services/ai-config');
                    const serviceRouter = createBaseApp(env);
                    AIConfigService(serviceRouter);
                    return await serviceRouter.handle(ctx.request, env);
                });
            });
            break;
            
        case 'config':
            app.group('/config', (group) => {
                group.get('/:type', async (ctx) => {
                    const { ConfigService } = await import('./services/config');
                    const serviceRouter = createBaseApp(env);
                    ConfigService(serviceRouter);
                    return await serviceRouter.handle(ctx.request, env);
                });
                group.post('/:type', async (ctx) => {
                    const { ConfigService } = await import('./services/config');
                    const serviceRouter = createBaseApp(env);
                    ConfigService(serviceRouter);
                    return await serviceRouter.handle(ctx.request, env);
                });
                group.delete('/cache', async (ctx) => {
                    const { ConfigService } = await import('./services/config');
                    const serviceRouter = createBaseApp(env);
                    ConfigService(serviceRouter);
                    return await serviceRouter.handle(ctx.request, env);
                });
            });
            break;
            
        case 'feed':
            // Feed routes
            app.group('/feed', (group) => {
                group.get('/', async (ctx) => {
                    const { FeedService } = await import('./services/feed');
                    const serviceRouter = createBaseApp(env);
                    FeedService(serviceRouter);
                    return await serviceRouter.handle(ctx.request, env);
                });
                group.get('/timeline', async (ctx) => {
                    const { FeedService } = await import('./services/feed');
                    const serviceRouter = createBaseApp(env);
                    FeedService(serviceRouter);
                    return await serviceRouter.handle(ctx.request, env);
                });
                group.post('/', async (ctx) => {
                    const { FeedService } = await import('./services/feed');
                    const serviceRouter = createBaseApp(env);
                    FeedService(serviceRouter);
                    return await serviceRouter.handle(ctx.request, env);
                });
                group.get('/:id', async (ctx) => {
                    const { FeedService } = await import('./services/feed');
                    const serviceRouter = createBaseApp(env);
                    FeedService(serviceRouter);
                    return await serviceRouter.handle(ctx.request, env);
                });
                group.get('/adjacent/:id', async (ctx) => {
                    const { FeedService } = await import('./services/feed');
                    const serviceRouter = createBaseApp(env);
                    FeedService(serviceRouter);
                    return await serviceRouter.handle(ctx.request, env);
                });
                group.post('/:id', async (ctx) => {
                    const { FeedService } = await import('./services/feed');
                    const serviceRouter = createBaseApp(env);
                    FeedService(serviceRouter);
                    return await serviceRouter.handle(ctx.request, env);
                });
                group.post('/top/:id', async (ctx) => {
                    const { FeedService } = await import('./services/feed');
                    const serviceRouter = createBaseApp(env);
                    FeedService(serviceRouter);
                    return await serviceRouter.handle(ctx.request, env);
                });
                group.delete('/:id', async (ctx) => {
                    const { FeedService } = await import('./services/feed');
                    const serviceRouter = createBaseApp(env);
                    FeedService(serviceRouter);
                    return await serviceRouter.handle(ctx.request, env);
                });
            });
            
            // Comment routes under /feed/comment
            app.group('/feed/comment', (group) => {
                group.get('/:feed', async (ctx) => {
                    const { CommentService } = await import('./services/comments');
                    const serviceRouter = createBaseApp(env);
                    CommentService(serviceRouter);
                    return await serviceRouter.handle(ctx.request, env);
                });
                group.post('/:feed', async (ctx) => {
                    const { CommentService } = await import('./services/comments');
                    const serviceRouter = createBaseApp(env);
                    CommentService(serviceRouter);
                    return await serviceRouter.handle(ctx.request, env);
                });
            });
            
            // Search route
            app.get('/search/:keyword', async (ctx) => {
                const { FeedService } = await import('./services/feed');
                const serviceRouter = createBaseApp(env);
                FeedService(serviceRouter);
                return await serviceRouter.handle(ctx.request, env);
            });
            
            // WordPress import
            app.post('/wp', async (ctx) => {
                const { FeedService } = await import('./services/feed');
                const serviceRouter = createBaseApp(env);
                FeedService(serviceRouter);
                return await serviceRouter.handle(ctx.request, env);
            });
            break;
            
        case 'tag':
            app.group('/tag', (group) => {
                group.get('/', async (ctx) => {
                    const { TagService } = await import('./services/tag');
                    const serviceRouter = createBaseApp(env);
                    TagService(serviceRouter);
                    return await serviceRouter.handle(ctx.request, env);
                });
                group.get('/:name', async (ctx) => {
                    const { TagService } = await import('./services/tag');
                    const serviceRouter = createBaseApp(env);
                    TagService(serviceRouter);
                    return await serviceRouter.handle(ctx.request, env);
                });
            });
            break;
            
        case 'storage':
            app.group('/storage', (group) => {
                group.post('/', async (ctx) => {
                    const { StorageService } = await import('./services/storage');
                    const serviceRouter = createBaseApp(env);
                    StorageService(serviceRouter);
                    return await serviceRouter.handle(ctx.request, env);
                });
            });
            break;
            
        case 'friend':
            app.group('/friend', (group) => {
                group.get('/', async (ctx) => {
                    const { FriendService } = await import('./services/friends');
                    const serviceRouter = createBaseApp(env);
                    FriendService(serviceRouter);
                    return await serviceRouter.handle(ctx.request, env);
                });
                group.post('/', async (ctx) => {
                    const { FriendService } = await import('./services/friends');
                    const serviceRouter = createBaseApp(env);
                    FriendService(serviceRouter);
                    return await serviceRouter.handle(ctx.request, env);
                });
                group.put('/:id', async (ctx) => {
                    const { FriendService } = await import('./services/friends');
                    const serviceRouter = createBaseApp(env);
                    FriendService(serviceRouter);
                    return await serviceRouter.handle(ctx.request, env);
                });
                group.delete('/:id', async (ctx) => {
                    const { FriendService } = await import('./services/friends');
                    const serviceRouter = createBaseApp(env);
                    FriendService(serviceRouter);
                    return await serviceRouter.handle(ctx.request, env);
                });
            });
            break;
            
        case 'seo':
            app.get('/seo/*', async (ctx) => {
                const { SEOService } = await import('./services/seo');
                const serviceRouter = createBaseApp(env);
                SEOService(serviceRouter);
                return await serviceRouter.handle(ctx.request, env);
            });
            break;
            
        case 'sub':
            app.get('/sub/:name', async (ctx) => {
                const { RSSService } = await import('./services/rss');
                const serviceRouter = createBaseApp(env);
                RSSService(serviceRouter);
                return await serviceRouter.handle(ctx.request, env);
            });
            break;
            
        case 'moments':
            app.group('/moments', (group) => {
                group.get('/', async (ctx) => {
                    const { MomentsService } = await import('./services/moments');
                    const serviceRouter = createBaseApp(env);
                    MomentsService(serviceRouter);
                    return await serviceRouter.handle(ctx.request, env);
                });
                group.post('/', async (ctx) => {
                    const { MomentsService } = await import('./services/moments');
                    const serviceRouter = createBaseApp(env);
                    MomentsService(serviceRouter);
                    return await serviceRouter.handle(ctx.request, env);
                });
                group.post('/:id', async (ctx) => {
                    const { MomentsService } = await import('./services/moments');
                    const serviceRouter = createBaseApp(env);
                    MomentsService(serviceRouter);
                    return await serviceRouter.handle(ctx.request, env);
                });
                group.delete('/:id', async (ctx) => {
                    const { MomentsService } = await import('./services/moments');
                    const serviceRouter = createBaseApp(env);
                    MomentsService(serviceRouter);
                    return await serviceRouter.handle(ctx.request, env);
                });
            });
            break;
            
        case 'favicon':
            app.get('/favicon', async (ctx) => {
                const { FaviconService } = await import('./services/favicon');
                const serviceRouter = createBaseApp(env);
                FaviconService(serviceRouter);
                return await serviceRouter.handle(ctx.request, env);
            });
            app.get('/favicon/original', async (ctx) => {
                const { FaviconService } = await import('./services/favicon');
                const serviceRouter = createBaseApp(env);
                FaviconService(serviceRouter);
                return await serviceRouter.handle(ctx.request, env);
            });
            app.post('/favicon', async (ctx) => {
                const { FaviconService } = await import('./services/favicon');
                const serviceRouter = createBaseApp(env);
                FaviconService(serviceRouter);
                return await serviceRouter.handle(ctx.request, env);
            });
            break;
            
        case 'user':
            app.group('/user', (group) => {
                group.get('/github', async (ctx) => {
                    const { UserService } = await import('./services/user');
                    const serviceRouter = createBaseApp(env);
                    UserService(serviceRouter);
                    return await serviceRouter.handle(ctx.request, env);
                });
                group.get('/github/callback', async (ctx) => {
                    const { UserService } = await import('./services/user');
                    const serviceRouter = createBaseApp(env);
                    UserService(serviceRouter);
                    return await serviceRouter.handle(ctx.request, env);
                });
                group.get('/profile', async (ctx) => {
                    const { UserService } = await import('./services/user');
                    const serviceRouter = createBaseApp(env);
                    UserService(serviceRouter);
                    return await serviceRouter.handle(ctx.request, env);
                });
            });
            break;
            
        case 'comment':
            app.delete('/comment/:id', async (ctx) => {
                const { CommentService } = await import('./services/comments');
                const serviceRouter = createBaseApp(env);
                CommentService(serviceRouter);
                return await serviceRouter.handle(ctx.request, env);
            });
            break;
            
        default:
            return null;
    }
    
    return app;
}

// Default health check route
export function createDefaultApp(env: Env) {
    const app = createBaseApp(env);
    app.get('/', () => 'Hi');
    return app;
}
