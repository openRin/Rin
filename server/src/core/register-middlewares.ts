import { cors } from "hono/cors";
import { timing } from "hono/timing";
import { authMiddleware, initContainerMiddleware } from "./hono-middleware";
import { pluginRegistry } from "../plugins/registry";
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

  app.use("*", timing({ totalDescription: "" }));
  app.use("*", initContainerMiddleware);
  app.use("*", authMiddleware);

  // 每个请求开始时同步插件启用状态。
  // 必须放在 authMiddleware 之后 —— 它要用 c.get('serverConfig')，那是
  // initContainerMiddleware 注入的。放在这里而不是启动时读一次，
  // 是因为 Worker 是常驻 isolate：管理员在后台关掉插件后必须立即生效，
  // 否则要等 isolate 被回收才生效。
  app.use("*", async (c, next) => {
    await pluginRegistry.syncEnabledFromConfig(c.get('serverConfig'));
    await next();
  });
}
