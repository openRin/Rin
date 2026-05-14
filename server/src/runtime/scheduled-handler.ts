import { drizzle } from "drizzle-orm/d1";
import { CacheImpl } from "../utils/cache";

export async function handleScheduled(
  _controller: ScheduledController | null,
  env: Env,
  ctx: ExecutionContext,
) {
  const schema = await import("../db/schema");
  const db = drizzle(env.DB, { schema });

  const serverConfig = new CacheImpl(db, env, "server.config", "database");
  const clientConfig = new CacheImpl(db, env, "client.config");
  const cache = new CacheImpl(db, env, "cache", undefined, clientConfig);

  const { friendCrontab } = await import("../services/friends");
  const { rssCrontab } = await import("../services/rss");

  await friendCrontab(env, ctx, db, cache, serverConfig, clientConfig);
  await rssCrontab(env, db);
}
