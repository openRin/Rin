import { createHonoApp } from "../core/hono-app";

let app: ReturnType<typeof createHonoApp> | null = null;

export function getApp() {
  if (!app) {
    app = createHonoApp();
  }

  return app;
}
