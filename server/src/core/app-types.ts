import type { Env, Hono } from "hono";
import type { Variables } from "./hono-types";

export type RinApp = Hono<{
  Bindings: Env;
  Variables: Variables;
}>;
