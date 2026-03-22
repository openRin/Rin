import { CloudflareTaskQueue, type TaskQueue } from "./cloudflare";

export function createTaskQueue(env: Env): TaskQueue {
  return new CloudflareTaskQueue(env.TASK_QUEUE);
}

export * from "./tasks";
