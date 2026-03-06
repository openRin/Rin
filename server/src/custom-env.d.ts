import type { QueueTask } from "./queue";

declare global {
  interface Env {
    AI_TASK_QUEUE?: Queue<QueueTask>;
  }
}

export {};
