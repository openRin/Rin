import { cors } from "hono/cors";
import { authMiddleware, initContainerMiddleware, timingMiddleware } from "./hono-middleware";
import type { RinApp } from "./app-types";

export function registerMiddlewares(app: RinApp) {
  app.use(
    "*",
    cors({
      origin: (origin) => origin,
      allowMethods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
      allowHeaders: ["content-type", "authorization", "x-csrf-token"],
      maxAge: 600,
      credentials: true,
    }),
  );

  app.use("*", timingMiddleware);
  app.use("*", initContainerMiddleware);
  app.use("*", authMiddleware);
}
