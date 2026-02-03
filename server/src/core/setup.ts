import type { Context, JWTUtils, OAuth2Utils, CookieValue } from "./types";
import { drizzle, DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from '../db/schema';
import { eq } from "drizzle-orm";
import { users } from "../db/schema";
import { CacheImpl } from "../utils/cache";
import { createOAuthPlugin, GitHubProvider } from "../utils/oauth";
import createJWT from "../utils/jwt";

export type DB = DrizzleD1Database<typeof import("../db/schema")>;

export interface AppStore {
    db: DB;
    env: Env;
    cache: CacheImpl;
    serverConfig: CacheImpl;
    clientConfig: CacheImpl;
    anyUser: (db: DB) => Promise<boolean>;
    jwt: JWTUtils;
    oauth2: OAuth2Utils;
}

const anyUser = async (db: DB) => (await db.query.users.findMany())?.length > 0;

export function createSetupPlugin(env: Env) {
    const db = drizzle(env.DB, { schema: schema });

    // Create cache instances
    const cache = new CacheImpl(db, env, "cache");
    const serverConfig = new CacheImpl(db, env, "server.config");
    const clientConfig = new CacheImpl(db, env, "client.config");
    
    let gh_client_id = env.RIN_GITHUB_CLIENT_ID;
    let gh_client_secret = env.RIN_GITHUB_CLIENT_SECRET;
    let jwt_secret = env.JWT_SECRET;

    if (!gh_client_id || !gh_client_secret) {
        throw new Error('Please set RIN_GITHUB_CLIENT_ID and RIN_GITHUB_CLIENT_SECRET');
    }
    if (!jwt_secret) {
        throw new Error('Please set JWT_SECRET');
    }

    const oauth = createOAuthPlugin({
        GitHub: new GitHubProvider({
            clientId: gh_client_id,
            clientSecret: gh_client_secret,
        }),
    });

    const jwt = createJWT(jwt_secret);

    return {
        db,
        env,
        cache,
        serverConfig,
        clientConfig,
        anyUser,
        jwt,
        oauth2: oauth
    };
}

export async function deriveAuth(context: Context): Promise<void> {
    const { headers, jwt, store } = context;
    
    const authorization = headers['authorization'];
    if (!authorization) {
        return;
    }
    
    const token = authorization.split(' ')[1];
    if (!token || !jwt) {
        return;
    }
    
    const profile = await jwt.verify(token);
    if (!profile) {
        return;
    }

    const user = await store.db.query.users.findFirst({ 
        where: eq(users.id, profile.id) 
    });
    
    if (!user) {
        return;
    }
    
    context.uid = user.id;
    context.username = user.username;
    context.admin = user.permission === 1;
}

// Cookie helper
export function createCookieHelpers(context: Context): Record<string, CookieValue> {
    const cookies: Record<string, CookieValue> = {};
    const cookieHeader = context.request.headers.get('cookie') || '';
    
    // Parse existing cookies
    const parsedCookies = new Map<string, string>();
    cookieHeader.split(';').forEach(cookie => {
        const [name, value] = cookie.trim().split('=');
        if (name && value) {
            parsedCookies.set(name, decodeURIComponent(value));
        }
    });

    // Create cookie proxy
    return new Proxy(cookies, {
        get(target, prop: string) {
            if (prop in target) {
                return target[prop];
            }
            
            const value = parsedCookies.get(prop) || '';
            return {
                value,
                set(options: { value: string; expires?: Date; path?: string; httpOnly?: boolean; secure?: boolean; sameSite?: 'strict' | 'lax' | 'none' }) {
                    let cookieStr = `${prop}=${encodeURIComponent(options.value)}`;
                    if (options.expires) {
                        cookieStr += `; Expires=${options.expires.toUTCString()}`;
                    }
                    if (options.path) {
                        cookieStr += `; Path=${options.path}`;
                    }
                    if (options.httpOnly) {
                        cookieStr += `; HttpOnly`;
                    }
                    if (options.secure) {
                        cookieStr += `; Secure`;
                    }
                    if (options.sameSite) {
                        cookieStr += `; SameSite=${options.sameSite}`;
                    }
                    context.set.headers.append('Set-Cookie', cookieStr);
                }
            };
        }
    });
}
