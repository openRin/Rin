import cron from "@elysiajs/cron";
import { eq } from "drizzle-orm";
import Elysia from "elysia";
import db from "../db/db";
import { friends } from "../db/schema";
import { logger } from "../utils";

export const CronService = new Elysia()
    .use(cron({
        name: 'friends-health',
        pattern: '*/20 * * * *',
        run: async () => {
            // update friends health
            logger.info('update friends health')
            const friend_list = await db.query.friends.findMany()
            let health = 0
            let unhealthy = 0
            for (const friend of friend_list) {
                logger.info(`checking ${friend.name}: ${friend.url}`)
                try {
                    const response = await fetch(friend.url)
                    logger.info(`response status: ${response.status}`)
                    logger.info(`response statusText: ${response.statusText}`)
                    if (response.ok) {
                        await db.update(friends).set({ health: "" }).where(eq(friends.id, friend.id))
                        health++
                    } else {
                        await db.update(friends).set({ health: `${response.status}` }).where(eq(friends.id, friend.id))
                        unhealthy++
                    }
                } catch (e: any) {
                    logger.error(e.message)
                    await db.update(friends).set({ health: e.message }).where(eq(friends.id, friend.id))
                    unhealthy++
                }
            }
            logger.info(`update friends health done. Total: ${health + unhealthy}, Healthy: ${health}, Unhealthy: ${unhealthy}`)
        }
    }))
