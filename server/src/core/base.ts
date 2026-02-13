import { Router, createRouter } from "./router";
import { corsMiddleware, timingMiddleware } from "./middleware";
import { deriveAuth, createCookieHelpers } from "./setup";
import type { Context, OAuth2Utils } from "./types";

// Lazy initialization container
class LazyInitContainer {
    private env: Env;
    private instances: Map<string, any> = new Map();
    private initializing: Map<string, Promise<any>> = new Map();

    constructor(env: Env) {
        this.env = env;
    }

    async get<T>(key: string, factory: () => Promise<T>): Promise<T> {
        // Return cached instance
        if (this.instances.has(key)) {
            return this.instances.get(key);
        }

        // Return existing initialization promise
        if (this.initializing.has(key)) {
            return this.initializing.get(key);
        }

        // Create new initialization
        const initPromise = factory().then(instance => {
            this.instances.set(key, instance);
            this.initializing.delete(key);
            return instance;
        });

        this.initializing.set(key, initPromise);
        return initPromise;
    }
}

export function createBaseApp(env: Env): Router {
    const container = new LazyInitContainer(env);
    const app = createRouter();

    // Add middlewares
    app.use(corsMiddleware());
    app.use(timingMiddleware());
    
    // Add auth derivation with lazy initialization
    app.use(async (context: Context) => {
        // Initialize cookies
        context.cookie = createCookieHelpers(context);
        
        // Use pre-existing state if provided (for tests), otherwise lazy-load
        // This allows tests to inject mock databases via app.state('db', mockDb)
        const db = context.store?.db ?? await container.get('db', async () => {
            const { drizzle } = await import('drizzle-orm/d1');
            const schema = await import('../db/schema');
            return drizzle(env.DB, { schema });
        });

        // Use pre-existing cache if provided, otherwise lazy-load
        const cache = context.store?.cache ?? await container.get('cache', async () => {
            const { CacheImpl } = await import('../utils/cache');
            const lazyDb = await container.get('db', async () => {
                const { drizzle } = await import('drizzle-orm/d1');
                const schema = await import('../db/schema');
                return drizzle(env.DB, { schema });
            });
            return new CacheImpl(lazyDb, env, "cache");
        });

        // Use pre-existing serverConfig if provided, otherwise lazy-load
        const serverConfig = context.store?.serverConfig ?? await container.get('serverConfig', async () => {
            const { CacheImpl } = await import('../utils/cache');
            const lazyDb = await container.get('db', async () => {
                const { drizzle } = await import('drizzle-orm/d1');
                const schema = await import('../db/schema');
                return drizzle(env.DB, { schema });
            });
            return new CacheImpl(lazyDb, env, "server.config");
        });

        // Use pre-existing clientConfig if provided, otherwise lazy-load
        const clientConfig = context.store?.clientConfig ?? await container.get('clientConfig', async () => {
            const { CacheImpl } = await import('../utils/cache');
            const lazyDb = await container.get('db', async () => {
                const { drizzle } = await import('drizzle-orm/d1');
                const schema = await import('../db/schema');
                return drizzle(env.DB, { schema });
            });
            return new CacheImpl(lazyDb, env, "client.config");
        });

        // Use pre-existing jwt if provided, otherwise lazy-load
        const jwt = context.store?.jwt ?? await container.get('jwt', async () => {
            const { default: createJWT } = await import('../utils/jwt');
            const secret = env.JWT_SECRET;
            if (!secret) {
                throw new Error('JWT_SECRET is not set');
            }
            return createJWT(secret);
        });

        // Lazy load OAuth only when needed
        let oauth2: OAuth2Utils | undefined = undefined;
        if (env.RIN_GITHUB_CLIENT_ID && env.RIN_GITHUB_CLIENT_SECRET) {
            oauth2 = await container.get('oauth2', async () => {
                const { createOAuthPlugin, GitHubProvider } = await import('../utils/oauth');
                return createOAuthPlugin({
                    GitHub: new GitHubProvider({ 
                        clientId: env.RIN_GITHUB_CLIENT_ID, 
                        clientSecret: env.RIN_GITHUB_CLIENT_SECRET 
                    })
                });
            });
        }

        // Set context store
        context.store = {
            db,
            env,
            cache,
            serverConfig,
            clientConfig,
            jwt,
            oauth2,
            anyUser: async () => (await db.query.users.findMany())?.length > 0
        };

        context.jwt = jwt;
        context.oauth2 = oauth2;
        
        // Derive auth
        await deriveAuth(context);
    });

    return app;
}

// Re-export types and utilities
export { createRouter } from "./router";
export type { Context, Handler, Middleware } from "./types";
