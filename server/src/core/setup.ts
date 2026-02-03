import type { Context, JWTUtils, CookieValue } from "./types";
import { eq } from "drizzle-orm";

export async function deriveAuth(context: Context): Promise<void> {
    const { cookie, jwt, store } = context;

    const token = cookie.token?.value;
    if (!token || !jwt) {
        return;
    }

    const profile = await jwt.verify(token);
    if (!profile) {
        return;
    }

    const { users } = await import("../db/schema");
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
