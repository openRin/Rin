import { desc, eq } from "drizzle-orm";
import type { CacheImpl, DB } from "../core/hono-types";
import { feeds } from "../db/schema";
import { syncFeedAISummaryQueueState } from "./feed-ai-summary";
import { clearFeedCache } from "./feed";
import { contentHasImagesMissingMetadata } from "../utils/image";
import { getAIConfig } from "../utils/db-config";

type ConfigReader = {
  get(key: string): Promise<unknown>;
};

function isAISummaryBackfillEligible(feed: {
  draft: number;
  ai_summary: string;
  ai_summary_status: string;
}) {
  if (feed.draft === 1) {
    return false;
  }

  if (feed.ai_summary.trim().length > 0) {
    return false;
  }

  return feed.ai_summary_status !== "pending" && feed.ai_summary_status !== "processing";
}

function isAISummaryForceBackfillEligible(feed: {
  draft: number;
  ai_summary_status: string;
}) {
  if (feed.draft === 1) {
    return false;
  }

  return feed.ai_summary_status !== "pending" && feed.ai_summary_status !== "processing";
}

export async function buildCompatTasksResponse(db: DB, serverConfig: ConfigReader, env: Env) {
  const aiConfig = await getAIConfig(serverConfig);
  const items = await db.query.feeds.findMany({
    columns: {
      id: true,
      content: true,
      ai_summary: true,
      ai_summary_status: true,
      draft: true,
    },
  });

  return {
    generatedAt: new Date().toISOString(),
    aiSummary: {
      enabled: aiConfig.enabled,
      queueConfigured: Boolean(env.TASK_QUEUE),
      eligible: items.filter(isAISummaryBackfillEligible).length,
      forceEligible: items.filter(isAISummaryForceBackfillEligible).length,
    },
    blurhash: {
      eligible: items.filter((item) => contentHasImagesMissingMetadata(item.content)).length,
    },
  };
}

export async function runCompatAISummaryBackfill(
  db: DB,
  cache: CacheImpl,
  serverConfig: ConfigReader,
  env: Env,
  force = false,
) {
  const aiConfig = await getAIConfig(serverConfig);
  if (!aiConfig.enabled) {
    throw new Error("AI summary is not enabled");
  }
  if (!env.TASK_QUEUE) {
    throw new Error("TASK_QUEUE binding is not configured");
  }

  const items = await db.query.feeds.findMany({
    columns: {
      id: true,
      alias: true,
      updatedAt: true,
      ai_summary: true,
      ai_summary_status: true,
      draft: true,
    },
    orderBy: [desc(feeds.updatedAt)],
  });

  let queued = 0;
  let skipped = 0;

  for (const item of items) {
    const eligible = force
      ? isAISummaryForceBackfillEligible(item)
      : isAISummaryBackfillEligible(item);

    if (!eligible) {
      skipped += 1;
      continue;
    }

    await syncFeedAISummaryQueueState(db, serverConfig, env, item.id, {
      draft: false,
      updatedAt: item.updatedAt,
      resetSummary: true,
    });
    await clearFeedCache(cache, item.id, item.alias, item.alias);
    queued += 1;
  }

  return {
    queued,
    skipped,
    forced: force,
  };
}

export async function listBlurhashCompatCandidates(db: DB) {
  const items = await db.query.feeds.findMany({
    columns: {
      id: true,
      title: true,
      content: true,
    },
    orderBy: [desc(feeds.updatedAt)],
  });

  return {
    generatedAt: new Date().toISOString(),
    items: items.filter((item) => contentHasImagesMissingMetadata(item.content)),
  };
}

export async function applyBlurhashCompatUpdate(db: DB, cache: CacheImpl, feedId: number, content: string) {
  const feed = await db.query.feeds.findFirst({
    where: eq(feeds.id, feedId),
    columns: {
      id: true,
      alias: true,
      content: true,
    },
  });

  if (!feed) {
    throw new Error("Feed not found");
  }

  if (feed.content === content) {
    return { updated: false };
  }

  await db.update(feeds).set({ content }).where(eq(feeds.id, feed.id));
  await clearFeedCache(cache, feed.id, feed.alias, feed.alias);

  return { updated: true };
}
