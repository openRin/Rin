import { CloudflareTaskQueue, type TaskQueue } from "./cloudflare";

export function createTaskQueue(env: Env): TaskQueue {
  return new CloudflareTaskQueue(env.AI_TASK_QUEUE);
}

export * from "./tasks";
