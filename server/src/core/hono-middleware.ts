// Hono middleware for Rin server
import { createMiddleware } from "hono/factory";
import { getCookie, setCookie } from "hono/cookie";
import { drizzle } from "drizzle-orm/d1";
import type { AppContext, Variables, JWTUtils, OAuth2Utils } from "./hono-types";
import { and, eq, gt, isNull, or } from "drizzle-orm";
import { profileAsync } from "./server-timing";

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
    await profileAsync(c, "init_container", async () => {
        const container = new LazyInitContainer(c.env);

        const db = await container.get('db', async () => profileAsync(c, "init_db", async () => {
            const schema = await import('../db/schema');
            return drizzle(c.env.DB, { schema });
        }));

        const cache = await container.get('cache', async () => profileAsync(c, "init_cache", async () => {
            const { CacheImpl } = await import('../utils/cache');
            const clientConfig = await container.get('clientConfig', async () => profileAsync(c, "init_client_config", async () => {
                const { CacheImpl } = await import('../utils/cache');
                return new CacheImpl(db, c.env, "client.config");
            }));
            return new CacheImpl(db, c.env, "cache", undefined, clientConfig);
        }));

        const serverConfig = await container.get('serverConfig', async () => profileAsync(c, "init_server_config", async () => {
                const { CacheImpl } = await import('../utils/cache');
                return new CacheImpl(db, c.env, "server.config", "database");
            }));

        const clientConfig = await container.get('clientConfig', async () => profileAsync(c, "init_client_config", async () => {
                const { CacheImpl } = await import('../utils/cache');
                return new CacheImpl(db, c.env, "client.config");
            }));

        const jwt = await container.get('jwt', async () => profileAsync(c, "init_jwt", async () => {
            const { default: createJWT } = await import('../utils/jwt');
            const secret = c.env.JWT_SECRET;
            if (!secret) {
                throw new Error('JWT_SECRET is not set');
            }
            return createJWT(secret);
        }));

        let oauth2: OAuth2Utils | undefined = undefined;
        if (c.env.RIN_GITHUB_CLIENT_ID && c.env.RIN_GITHUB_CLIENT_SECRET) {
            oauth2 = await container.get('oauth2', async () => profileAsync(c, "init_oauth2", async () => {
                    const { createOAuthPlugin, GitHubProvider } = await import('../utils/oauth');
                    return createOAuthPlugin({
                        GitHub: new GitHubProvider({
                            clientId: c.env.RIN_GITHUB_CLIENT_ID,
                            clientSecret: c.env.RIN_GITHUB_CLIENT_SECRET
                        })
                    });
                }));
        }

        c.set('db', db);
        c.set('cache', cache);
        c.set('serverConfig', serverConfig);
        c.set('clientConfig', clientConfig);
        c.set('jwt', jwt);
        c.set('oauth2', oauth2);
        c.set('admin', false);
        c.set('authType', undefined);
        c.set('apiKeyScopes', undefined);
        c.set('env', c.env);
    });

    await next();
});

// Auth middleware - derive user from JWT
export const authMiddleware = createMiddleware<{
    Bindings: Env;
    Variables: Variables;
}>(async (c, next) => {
    await profileAsync(c, "auth_middleware", async () => {
        const jwt = c.get('jwt');
        const db = c.get('db');

        const bearerToken = await profileAsync(c, "auth_token", () => {
            const authHeader = c.req.header('authorization');
            if (authHeader && authHeader.startsWith('Bearer ')) {
                return authHeader.substring(7);
            }
            return undefined;
        });
        const cookieToken = await profileAsync(c, "auth_cookie_token", () => {
            return getCookie(c, 'token');
        });

        if (bearerToken && jwt) {
            const profile = await profileAsync(c, "auth_verify", () => jwt.verify(bearerToken));
            if (profile) {
                const { users } = await import("../db/schema");
                const user = await profileAsync(c, "auth_user_lookup", () => db.query.users.findFirst({
                    where: eq(users.id, profile.id)
                }));

                if (user) {
                    c.set('uid', user.id);
                    c.set('username', user.username);
                    c.set('admin', user.permission === 1);
                    c.set('authType', 'jwt');
                    return;
                }
            }

            const { apiKeys } = await import("../db/schema");
            const { hashApiKey, parseApiKeyScopes } = await import("../utils/api-keys");
            const now = new Date();
            const keyHash = await profileAsync(c, "auth_api_key_hash", () => hashApiKey(bearerToken));
            const apiKey = await profileAsync(c, "auth_api_key_lookup", () => db.query.apiKeys.findFirst({
                where: and(
                    eq(apiKeys.keyHash, keyHash),
                    isNull(apiKeys.revokedAt),
                    or(isNull(apiKeys.expiresAt), gt(apiKeys.expiresAt, now)),
                ),
                with: {
                    createdByUser: true,
                },
            }));

            if (apiKey?.createdByUser) {
                await profileAsync(c, "auth_api_key_touch", () => db.update(apiKeys)
                    .set({ lastUsedAt: now, updatedAt: now })
                    .where(eq(apiKeys.id, apiKey.id)));

                const scopes = parseApiKeyScopes(apiKey.scopes);
                c.set('uid', apiKey.createdByUser.id);
                c.set('username', apiKey.createdByUser.username);
                c.set('admin', apiKey.createdByUser.permission === 1);
                c.set('authType', 'api-key');
                c.set('apiKeyScopes', scopes);
                return;
            }
        }

        if (cookieToken && jwt) {
            const profile = await profileAsync(c, "auth_cookie_verify", () => jwt.verify(cookieToken));
            if (profile) {
                const { users } = await import("../db/schema");
                const user = await profileAsync(c, "auth_cookie_user_lookup", () => db.query.users.findFirst({
                    where: eq(users.id, profile.id)
                }));

                if (user) {
                    c.set('uid', user.id);
                    c.set('username', user.username);
                    c.set('admin', user.permission === 1);
                    c.set('authType', 'jwt');
                }
            }
        }
    });

    if (c.get("authType") === "api-key") {
        const { getRequiredApiKeyScope, hasApiKeyScope } = await import("../utils/api-keys");
        const requiredScope = getRequiredApiKeyScope(c.req.method, c.req.path);

        if (!requiredScope) {
            return c.text("API key does not have access to this route", 403);
        }

        if (!hasApiKeyScope(c.get("apiKeyScopes"), requiredScope)) {
            return c.text("API key does not have the required scope", 403);
        }
    }

    await next();
});

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
