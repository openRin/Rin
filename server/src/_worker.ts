import { drizzle, DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from './db/schema';
import server from "./server";
import { CacheImpl } from "./utils/cache";
export type DB = DrizzleD1Database<typeof import("./db/schema")>

export default {
    async fetch(
        request: Request,
        env: Env,
    ): Promise<Response> {
        return await server
            .handle(request)
    },
    async scheduled(
        _controller: ScheduledController | null,
        env: Env,
        ctx: ExecutionContext
    ) {
        const db = drizzle(env.DB, { schema: schema })

        // Create cache instances
        const cache = new CacheImpl(db, env, "cache");
        const serverConfig = new CacheImpl(db, env, "server.config");
        const clientConfig = new CacheImpl(db, env, "client.config");

        // await friendCrontab(env, ctx, db, cache, serverConfig, clientConfig)
        // await rssCrontab(env, db)
    },
}
