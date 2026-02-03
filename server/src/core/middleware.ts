import type { Context, Middleware } from "./types";

export const corsMiddleware = (): Middleware => {
    return async (context, env) => {
        const { request, set } = context;
        const origin = request.headers.get('origin') || '*';
        
        // Set CORS headers
        set.headers.set('Access-Control-Allow-Origin', origin);
        set.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
        set.headers.set('Access-Control-Allow-Headers', 'authorization, content-type');
        set.headers.set('Access-Control-Max-Age', '600');
        set.headers.set('Access-Control-Allow-Credentials', 'true');
        
        // Handle preflight
        if (request.method === 'OPTIONS') {
            return new Response(null, { status: 204, headers: set.headers });
        }
    };
};

export const timingMiddleware = (): Middleware => {
    return async (context) => {
        const start = Date.now();
        
        // Store original set.status setter
        const originalHeaders = context.set.headers;
        
        // Add timing header after request is processed
        const end = Date.now();
        const duration = end - start;
        context.set.headers.set('Server-Timing', `total;dur=${duration}`);
    };
};
