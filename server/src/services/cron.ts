import cron from "@elysiajs/cron";
import { eq } from "drizzle-orm";
import Elysia from "elysia";
import type { DB } from "../_worker";
import { friends } from "../db/schema";

export const CronService = (db: DB) => new Elysia({ aot: false })
    .use(cron({
        name: 'friends-health',
        pattern: '*/20 * * * *',
        run: async () => {
            // update friends health
            console.info('update friends health')
            const friend_list = await db.query.friends.findMany()
            let health = 0
            let unhealthy = 0
            for (const friend of friend_list) {
                console.info(`checking ${friend.name}: ${friend.url}`)
                try {
                    const response = await fetch(friend.url)
                    console.info(`response status: ${response.status}`)
                    console.info(`response statusText: ${response.statusText}`)
                    if (response.ok) {
                        await db.update(friends).set({ health: "" }).where(eq(friends.id, friend.id))
                        health++
                    } else {
                        await db.update(friends).set({ health: `${response.status}` }).where(eq(friends.id, friend.id))
                        unhealthy++
                    }
                } catch (e: any) {
                    console.error(e.message)
                    await db.update(friends).set({ health: e.message }).where(eq(friends.id, friend.id))
                    unhealthy++
                }
            }
            console.info(`update friends health done. Total: ${health + unhealthy}, Healthy: ${health}, Unhealthy: ${unhealthy}`)
        }
    }))
