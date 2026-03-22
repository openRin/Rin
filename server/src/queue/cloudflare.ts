import type { QueueTask } from "./tasks";

export interface TaskQueue {
  send(task: QueueTask): Promise<void>;
}

export class CloudflareTaskQueue implements TaskQueue {
  constructor(private readonly queue?: Queue<QueueTask>) {}

  async send(task: QueueTask): Promise<void> {
    if (!this.queue) {
      throw new Error("TASK_QUEUE binding is not configured");
    }

    await this.queue.send(task);
  }
}
