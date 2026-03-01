// Hono app factory for Rin server
import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env } from "hono";
import { initContainerMiddleware, authMiddleware, timingMiddleware } from "./hono-middleware";
import type { Variables } from "./hono-types";

// Service imports
import { FeedService, SearchService, WordPressService } from "../services/feed";
import { TagService } from "../services/tag";
import { CommentService } from "../services/comments";
import { StorageService } from "../services/storage";
import { FriendService } from "../services/friends";
import { MomentsService } from "../services/moments";
import { UserService } from "../services/user";
import { PasswordAuthService } from "../services/auth";
import { ConfigService } from "../services/config";
import { SEOService } from "../services/seo";
import { RSSService } from "../services/rss";
import { FaviconService } from "../services/favicon";

export function createHonoApp(): Hono<{
    Bindings: Env;
    Variables: Variables;
}> {
    const app = new Hono<{
        Bindings: Env;
        Variables: Variables;
    }>();

    // Health check
    app.get('/', (c) => c.text('Hi'));

    // Mount all services with their prefixes
    // Feed service (includes search and WordPress import)
    app.route('/feed', FeedService());
    app.route('/search', SearchService());
    app.route('/wp', WordPressService());

    // Tag service
    app.route('/tag', TagService());

    // Comment service
    app.route('/comment', CommentService());

    // Storage service
    app.route('/storage', StorageService());

    // Friend service
    app.route('/friend', FriendService());

    // Moments service
    app.route('/moments', MomentsService());

    // User service
    app.route('/user', UserService());

    // Auth service
    app.route('/auth', PasswordAuthService());

    // Config service
    app.route('/config', ConfigService());

    // SEO service
    app.route('/seo', SEOService());

    // Favicon service
    app.route('/', FaviconService());

    // 404 handler
    app.notFound((c) => {
        return c.json({
            success: false,
            error: {
                code: 'NOT_FOUND',
                message: `Route ${c.req.method} ${c.req.path} not found`,
            },
        }, 404);
    });

    // Error handler
    app.onError((err, c) => {
        console.error('Error:', err);

        // Check if it's an AppError
        const error = err as any;
        if (error.code && error.statusCode) {
            return c.json({
                success: false,
                error: {
                    code: error.code,
                    message: error.message,
                    details: error.details,
                },
            }, error.statusCode as any);
        }

        // Default error response
        return c.json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: err.message || 'An unexpected error occurred',
            },
        }, 500);
    });


    const apiApp = new Hono<{
        Bindings: Env;
        Variables: Variables;
    }>();

    
    // Global middleware
    apiApp.use('*', cors({
        origin: (origin) => origin,
        allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        allowHeaders: ['content-type', 'authorization', 'x-csrf-token'],
        maxAge: 600,
        credentials: true,
    }));

    apiApp.use('*', timingMiddleware);
    apiApp.use('*', initContainerMiddleware);
    apiApp.use('*', authMiddleware);

    apiApp.route("/api", app)

    // RSS service (native RSS endpoints at root)
    apiApp.route('/', RSSService());
    
    return apiApp;
}
