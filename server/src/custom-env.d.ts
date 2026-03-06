import type { QueueTask } from "./queue";

declare global {
  interface Env {
    AI_TASK_QUEUE?: Queue<QueueTask>;
    R2_BUCKET?: R2Bucket;
  }
}

export {};
