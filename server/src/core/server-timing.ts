import type { Context } from "hono";
import { wrapTime } from "hono/timing";

export async function profileAsync<T>(
  c: Context,
  name: string,
  task: () => Promise<T> | T,
): Promise<T> {
  return wrapTime(c, name, Promise.resolve(task()));
}
