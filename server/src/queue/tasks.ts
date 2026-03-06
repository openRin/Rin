export const FEED_AI_SUMMARY_TASK = "feed.ai-summary.generate" as const;

export type FeedAISummaryStatus =
  | "idle"
  | "pending"
  | "processing"
  | "completed"
  | "failed";

export interface FeedAISummaryTaskPayload {
  feedId: number;
  expectedUpdatedAt?: string;
  expectedUpdatedAtUnix?: number;
}

export interface FeedAISummaryTask {
  type: typeof FEED_AI_SUMMARY_TASK;
  payload: FeedAISummaryTaskPayload;
}

export type QueueTask = FeedAISummaryTask;

export function createFeedAISummaryTask(
  payload: FeedAISummaryTaskPayload,
): FeedAISummaryTask {
  return {
    type: FEED_AI_SUMMARY_TASK,
    payload,
  };
}

export function isQueueTask(value: unknown): value is QueueTask {
  if (!value || typeof value !== "object") {
    return false;
  }

  const task = value as Partial<QueueTask>;
  if (task.type !== FEED_AI_SUMMARY_TASK) {
    return false;
  }

  const payload = task.payload as Partial<FeedAISummaryTaskPayload> | undefined;
  return (
    Boolean(payload) &&
    typeof payload?.feedId === "number" &&
    (
      typeof payload?.expectedUpdatedAtUnix === "number" ||
      typeof payload?.expectedUpdatedAt === "string"
    )
  );
}
