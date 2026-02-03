import { Router, createRouter } from "./router";
import { corsMiddleware, timingMiddleware } from "./middleware";
import { createSetupPlugin, deriveAuth, createCookieHelpers } from "./setup";
import type { Context } from "./types";

export function createBaseApp(env: Env): Router {
    const setup = createSetupPlugin(env);
    
    const app = createRouter();
    
    // Set state
    app.state('db', setup.db);
    app.state('env', setup.env);
    app.state('cache', setup.cache);
    app.state('serverConfig', setup.serverConfig);
    app.state('clientConfig', setup.clientConfig);
    app.state('anyUser', setup.anyUser);
    app.state('jwt', setup.jwt);
    app.state('oauth2', setup.oauth2);

    // Add middlewares
    app.use(corsMiddleware());
    app.use(timingMiddleware());
    
    // Add auth derivation and cookie support
    app.use(async (context: Context) => {
        // Initialize cookies
        context.cookie = createCookieHelpers(context);
        
        // Derive auth
        await deriveAuth(context);
    });

    return app;
}

// Re-export types and utilities
export { createRouter } from "./router";
export type { Context, Handler, Middleware } from "./types";
