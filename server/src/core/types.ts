// Core types for Rin server
import type { Context as HonoContext } from "hono";

// Re-export from hono-types
export type { DB, Variables, AppContext, JWTUtils, OAuth2Utils } from "./hono-types";

// Middleware type
export type Middleware = (context: Context, env: Env) => Promise<Response | void>;

// Context type matching the error handler needs
export interface Context {
    request: Request;
    url: URL;
    headers: Headers;
    set: {
        headers: Headers;
    };
}

// Legacy types for backward compatibility
export type Handler = (context: Context) => Promise<any>;

export interface RouteDefinition {
    method: string;
    path: string;
    handler: Handler;
}

export type CookieValue = {
    value: string;
    options?: {
        httpOnly?: boolean;
        secure?: boolean;
        sameSite?: 'strict' | 'lax' | 'none';
        maxAge?: number;
        expires?: Date;
        path?: string;
        domain?: string;
    };
};

// CacheImpl interface
export interface CacheImpl {
    get(key: string): Promise<any | null>;
    set(key: string, value: any, save?: boolean): Promise<void>;
    delete(key: string, save?: boolean): Promise<void>;
    deletePrefix(prefix: string): Promise<void>;
    getOrSet<T>(key: string, factory: () => Promise<T>): Promise<T>;
    getOrDefault<T>(key: string, defaultValue: T): Promise<T>;
    getBySuffix(suffix: string): Promise<any[]>;
    all(): Promise<Map<string, any>>;
    save(): Promise<void>;
    clear(): Promise<void>;
}
