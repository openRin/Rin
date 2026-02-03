// Type definitions for the lightweight framework

export interface Context {
    request: Request;
    url: URL;
    params: Record<string, string>;
    query: Record<string, any>;
    headers: Record<string, string>;
    body: any;
    store: Record<string, any>;
    set: {
        status: number;
        headers: Headers;
    };
    cookie: Record<string, CookieValue>;
    jwt?: JWTUtils;
    oauth2?: OAuth2Utils;
    uid?: number;
    admin: boolean;
    username?: string;
}

export interface CookieValue {
    value: string;
    expires?: Date;
    path?: string;
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: 'strict' | 'lax' | 'none';
    set(options: { value: string; expires?: Date; path?: string; httpOnly?: boolean; secure?: boolean; sameSite?: 'strict' | 'lax' | 'none' }): void;
}

export interface JWTUtils {
    sign(payload: any): Promise<string>;
    verify(token: string): Promise<any | null>;
}

export interface OAuth2Utils {
    generateState(): string;
    createRedirectUrl(state: string, provider: string): string;
    authorize(provider: string, code: string): Promise<{ accessToken: string } | null>;
}

export type Handler = (context: Context) => Promise<any> | any;
export type Middleware = (context: Context, env: Env, container?: any) => Promise<Response | void> | Response | void;

export interface RouteDefinition {
    path: string;
    handler: Handler;
    schema?: any;
}

// Schema types (TypeBox compatible)
export const t = {
    Object: (properties: Record<string, any>, options?: { additionalProperties?: boolean }) => ({
        type: 'object',
        properties,
        ...options
    }),
    String: (options?: { optional?: boolean }) => ({ type: 'string', optional: options?.optional }),
    Number: (options?: { optional?: boolean }) => ({ type: 'number', optional: options?.optional }),
    Boolean: (options?: { optional?: boolean }) => ({ type: 'boolean', optional: options?.optional }),
    Integer: (options?: { optional?: boolean }) => ({ type: 'number', optional: options?.optional }),
    Date: (options?: { optional?: boolean }) => ({ type: 'string', format: 'date-time', optional: options?.optional }),
    Array: (items: any, options?: { optional?: boolean }) => ({ type: 'array', items, optional: options?.optional }),
    File: (options?: { optional?: boolean }) => ({ type: 'file', optional: options?.optional }),
    Optional: (schema: any) => ({ ...schema, optional: true }),
    Numeric: (options?: { optional?: boolean }) => ({ type: 'number', optional: options?.optional }),
};
