// Hono middleware for Rin server
import { createMiddleware } from "hono/factory";
import { getCookie, setCookie } from "hono/cookie";
import { drizzle } from "drizzle-orm/d1";
import type { AppContext, Variables, JWTUtils, OAuth2Utils } from "./hono-types";
import { eq } from "drizzle-orm";
import { timing } from "hono/timing";

// Lazy initialization container
class LazyInitContainer {
    private env: Env;
    private instances: Map<string, any> = new Map();
    private initializing: Map<string, Promise<any>> = new Map();

    constructor(env: Env) {
        this.env = env;
    }

    async get<T>(key: string, factory: () => Promise<T>): Promise<T> {
        if (this.instances.has(key)) {
            return this.instances.get(key);
        }

        if (this.initializing.has(key)) {
            return this.initializing.get(key);
        }

        const initPromise = factory().then(instance => {
            this.instances.set(key, instance);
            this.initializing.delete(key);
            return instance;
        });

        this.initializing.set(key, initPromise);
        return initPromise;
    }
}

// Create container per request
export const initContainerMiddleware = createMiddleware<{
    Bindings: Env;
    Variables: Variables;
}>(async (c, next) => {
    const container = new LazyInitContainer(c.env);

    // Initialize database
    const db = await container.get('db', async () => {
        const schema = await import('../db/schema');
        return drizzle(c.env.DB, { schema });
    });

    // Initialize cache
    const cache = await container.get('cache', async () => {
        const { CacheImpl } = await import('../utils/cache');
        return new CacheImpl(db, c.env, "cache");
    });

    // Initialize server config
    const serverConfig = await container.get('serverConfig', async () => {
        const { CacheImpl } = await import('../utils/cache');
        return new CacheImpl(db, c.env, "server.config", "database");
    });

    // Initialize client config
    const clientConfig = await container.get('clientConfig', async () => {
        const { CacheImpl } = await import('../utils/cache');
        return new CacheImpl(db, c.env, "client.config");
    });

    // Initialize JWT
    const jwt = await container.get('jwt', async () => {
        const { default: createJWT } = await import('../utils/jwt');
        const secret = c.env.JWT_SECRET;
        if (!secret) {
            throw new Error('JWT_SECRET is not set');
        }
        return createJWT(secret);
    });

    // Initialize OAuth2 (lazy)
    let oauth2: OAuth2Utils | undefined = undefined;
    if (c.env.RIN_GITHUB_CLIENT_ID && c.env.RIN_GITHUB_CLIENT_SECRET) {
        oauth2 = await container.get('oauth2', async () => {
            const { createOAuthPlugin, GitHubProvider } = await import('../utils/oauth');
            return createOAuthPlugin({
                GitHub: new GitHubProvider({
                    clientId: c.env.RIN_GITHUB_CLIENT_ID,
                    clientSecret: c.env.RIN_GITHUB_CLIENT_SECRET
                })
            });
        });
    }

    // Set variables in context
    c.set('db', db);
    c.set('cache', cache);
    c.set('serverConfig', serverConfig);
    c.set('clientConfig', clientConfig);
    c.set('jwt', jwt);
    c.set('oauth2', oauth2);
    c.set('admin', false);
    c.set('env', c.env);

    await next();
});

// Auth middleware - derive user from JWT
export const authMiddleware = createMiddleware<{
    Bindings: Env;
    Variables: Variables;
}>(async (c, next) => {
    const jwt = c.get('jwt');
    const db = c.get('db');

    // Try to get token from Authorization header first, then fallback to cookie
    let token: string | undefined;
    const authHeader = c.req.header('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
    } else {
        token = getCookie(c, 'token');
    }

    if (token && jwt) {
        const profile = await jwt.verify(token);
        if (profile) {
            const { users } = await import("../db/schema");
            const user = await db.query.users.findFirst({
                where: eq(users.id, profile.id)
            });

            if (user) {
                c.set('uid', user.id);
                c.set('username', user.username);
                c.set('admin', user.permission === 1);
            }
        }
    }

    await next();
});

// Timing middleware using Hono's built-in timing
export const timingMiddleware = timing();

// Helper to set JWT cookie
export function setJWTCookie(c: AppContext, token: string) {
    setCookie(c, 'token', token, {
        expires: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
        path: '/',
        httpOnly: true,
        secure: true,
        sameSite: 'Lax',
    });
}

// Helper to clear JWT cookie
export function clearJWTCookie(c: AppContext) {
    setCookie(c, 'token', '', {
        expires: new Date(0),
        path: '/',
        httpOnly: true,
        secure: true,
        sameSite: 'Lax',
    });
}
