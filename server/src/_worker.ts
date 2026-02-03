import { drizzle, DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from './db/schema';
import { createApp, createDefaultApp } from "./server-new";
import { CacheImpl } from "./utils/cache";

export type DB = DrizzleD1Database<typeof import("./db/schema")>

export default {
    async fetch(
        request: Request,
        env: Env,
    ): Promise<Response> {
        const url = new URL(request.url);
        const app = createApp(env, url.pathname);
        
        if (app) {
            return await app.handle(request, env);
        }
        
        // Default handler for unmatched routes
        const defaultApp = createDefaultApp(env);
        return await defaultApp.handle(request, env);
    },
    
    async scheduled(
        _controller: ScheduledController | null,
        env: Env,
        ctx: ExecutionContext
    ) {
        const db = drizzle(env.DB, { schema: schema });

        // Create cache instances
        const cache = new CacheImpl(db, env, "cache");
        const serverConfig = new CacheImpl(db, env, "server.config");
        const clientConfig = new CacheImpl(db, env, "client.config");

        // Import and run crontab functions
        const { friendCrontab } = await import('./services/friends');
        const { rssCrontab } = await import('./services/rss');

        // await friendCrontab(env, ctx, db, cache, serverConfig, clientConfig)
        // await rssCrontab(env, db)
    },
}
