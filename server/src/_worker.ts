import { drizzle } from "drizzle-orm/d1";
import { createHonoApp } from "./core/hono-app";
import { CacheImpl } from "./utils/cache";
import { FaviconService } from "./services/favicon";
import { Hono } from "hono";
import type { Variables } from "hono/types";
import { initContainerMiddleware, timingMiddleware } from "./core/hono-middleware";

// Create app instance (singleton)
let app: ReturnType<typeof createHonoApp> | null = null;

function getApp() {
    if (!app) {
        app = createHonoApp();
    }
    return app;
}

export default {
    async fetch(
        request: Request,
        env: Env,
    ): Promise<Response> {
        const url = new URL(request.url);
        const path = url.pathname;

        if (path.startsWith('/favicon.ico')) {

            const app = new Hono<{
                Bindings: Env;
                Variables: Variables;
            }>();
        
            app.use('*', timingMiddleware);
            app.use('*', initContainerMiddleware);
            app.route('/', FaviconService());
            return await app.fetch(request, env);
        }

        // Handle RSS feeds directly (native RSS support at root path)
        // Matches: /rss.xml, /atom.xml, /rss.json, /feed.json, /feed.xml
        if (path.match(/^\/(rss\.xml|atom\.xml|rss\.json|feed\.json|feed\.xml)$/) || path.startsWith('/api/')) {
            const honoApp = getApp();
            return await honoApp.fetch(request, env);
        }

        // Serve static assets (for files with extensions)
        if (path.match(/\.\w+$/) && env.ASSETS) {
            try {
                const asset = await env.ASSETS.fetch(request);
                // Accept 200 OK and 3xx redirects
                if (asset && (asset.status === 200 || (asset.status >= 300 && asset.status < 400))) {
                    return asset;
                }
            } catch (e) {
                // Asset not found, continue to serve index.html
            }
        }

        // For all other routes (SPA), serve index.html
        if (env.ASSETS) {
            try {
                const indexRequest = new Request(new URL('/', url.origin), request);
                const indexResponse = await env.ASSETS.fetch(indexRequest);
                // Accept 200 OK and 3xx redirects
                if (indexResponse && (indexResponse.status === 200 || (indexResponse.status >= 300 && indexResponse.status < 400))) {
                    return indexResponse;
                }
            } catch (e) {
                // index.html not found
            }
        }

        // Fallback: return a simple hello
        return new Response('Hi', { status: 200 });
    },

    async scheduled(
        _controller: ScheduledController | null,
        env: Env,
        ctx: ExecutionContext
    ) {
        const schema = await import('./db/schema');
        const db = drizzle(env.DB, { schema: schema });

        // Create cache instances
        // Server config is forced to use database storage to prevent API key leakage
        // Client config can still use S3 if configured for better performance
        const cache = new CacheImpl(db, env, "cache");
        const serverConfig = new CacheImpl(db, env, "server.config", "database");
        const clientConfig = new CacheImpl(db, env, "client.config");

        // Import and run crontab functions
        const { friendCrontab } = await import('./services/friends');
        const { rssCrontab } = await import('./services/rss');

        await friendCrontab(env, ctx, db, cache, serverConfig, clientConfig)
        await rssCrontab(env, db)
    },
}
