import { drizzle } from "drizzle-orm/d1";
import { CacheImpl } from "../utils/cache";
import { isQueueTask, FEED_AI_SUMMARY_TASK } from "../queue";
import { processFeedAISummaryTask } from "../services/feed-ai-summary";
import { clearFeedCache } from "../services/feed";

export async function handleQueue(
  batch: MessageBatch<unknown>,
  env: Env,
  _ctx: ExecutionContext,
) {
  const schema = await import("../db/schema");
  const db = drizzle(env.DB, { schema });
  const cache = new CacheImpl(db, env, "cache");
  const serverConfig = new CacheImpl(db, env, "server.config", "database");

  for (const message of batch.messages) {
    const body = message.body;
    if (!isQueueTask(body)) {
      message.ack();
      continue;
    }

    switch (body.type) {
      case FEED_AI_SUMMARY_TASK:
        await processFeedAISummaryTask(
          env,
          db,
          cache,
          serverConfig,
          body.payload,
          clearFeedCache,
        );
        message.ack();
        break;
      default:
        message.ack();
        break;
    }
  }
}
