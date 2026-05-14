import { Hono } from "hono";
import type { Env } from "hono";
import type { Variables } from "./hono-types";
import { registerErrorHandlers } from "./error-response";
import { registerMiddlewares } from "./register-middlewares";
import { registerRoutes } from "./register-routes";

export function createHonoApp(): Hono<{
    Bindings: Env;
    Variables: Variables;
}> {
    const app = new Hono<{
        Bindings: Env;
        Variables: Variables;
    }>();

    registerMiddlewares(app);
    registerRoutes(app);
    registerErrorHandlers(app);

    return app;
}
