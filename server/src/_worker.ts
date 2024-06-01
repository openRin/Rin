import { eq } from "drizzle-orm";
import { drizzle, DrizzleD1Database } from "drizzle-orm/d1";
import { Elysia } from "elysia";
import type { Env } from "./db/db";
import * as schema from './db/schema';
import { app } from "./server";

export type DB = DrizzleD1Database<typeof import("./db/schema")>

export default {
    async fetch(
        request: Request,
        env: Env,
    ): Promise<Response> {
        const db = drizzle(env.DB, { schema: schema })
        return await new Elysia({ aot: false })
            .use(app(db, env))
            .handle(request)
    },
    async scheduled(
        controller: ScheduledController | null,
        env: Env,
        ctx: ExecutionContext
    ) {
        const db = drizzle(env.DB, { schema: schema })
        const friend_list = await db.query.friends.findMany()
        console.info(`total friends: ${friend_list.length}`)
        let health = 0
        let unhealthy = 0
        for (const friend of friend_list) {
            console.info(`checking ${friend.name}: ${friend.url}`)
            try {
                const response = await fetch(friend.url)
                console.info(`response status: ${response.status}`)
                console.info(`response statusText: ${response.statusText}`)
                if (response.ok) {
                    ctx.waitUntil(db.update(schema.friends).set({ health: "" }).where(eq(schema.friends.id, friend.id)))
                    health++
                } else {
                    ctx.waitUntil(db.update(schema.friends).set({ health: `${response.status}` }).where(eq(schema.friends.id, friend.id)))
                    unhealthy++
                }
            } catch (e: any) {
                console.error(e.message)
                ctx.waitUntil(db.update(schema.friends).set({ health: e.message }).where(eq(schema.friends.id, friend.id)))
                unhealthy++
            }
        }
        console.info(`update friends health done. Total: ${health + unhealthy}, Healthy: ${health}, Unhealthy: ${unhealthy}`)
    },
}
