import { Hono } from "hono";
import type { Variables } from "./hono-types";
import { registerErrorHandlers } from "./error-response";
import { registerMiddlewares } from "./register-middlewares";
import { registerRoutes } from "./register-routes";
import { registerPlugins } from "../plugins";

export function createHonoApp(): Hono<{
    Bindings: Env;
    Variables: Variables;
}> {
    const app = new Hono<{
        Bindings: Env;
        Variables: Variables;
    }>();

    // 插件必须在路由注册之前就位：
    // registerRoutes 会调用 mountPluginRoutes 挂载插件自定义端点，
    // 那时注册表里得已经有插件了。
    registerPlugins();

    registerMiddlewares(app);
    registerRoutes(app);
    registerErrorHandlers(app);

    return app;
}
