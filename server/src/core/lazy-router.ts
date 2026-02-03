import type { Context, Handler, Middleware } from "./types";
import { LazyContainer } from "./container";

// Lazy route definition - handler is loaded on first match
interface LazyRouteDefinition {
    path: string;
    method: string;
    handlerLoader: () => Promise<Handler> | Handler;
    schema?: any;
    loaded?: boolean;
    handler?: Handler;
}

export class LazyRouter {
    private routes: Map<string, LazyRouteDefinition[]> = new Map();
    private middlewares: Middleware[] = [];
    private container: LazyContainer;

    constructor(container: LazyContainer) {
        this.container = container;
    }

    use(middleware: Middleware): this {
        this.middlewares.push(middleware);
        return this;
    }

    private addRoute(method: string, path: string, handlerLoader: () => Promise<Handler> | Handler, schema?: any): this {
        if (!this.routes.has(method)) {
            this.routes.set(method, []);
        }
        this.routes.get(method)!.push({ 
            path, 
            method,
            handlerLoader, 
            schema,
            loaded: false 
        });
        return this;
    }

    // Register lazy route with dynamic import
    get(path: string, handlerLoader: () => Promise<Handler> | Handler, schema?: any): this {
        return this.addRoute('GET', path, handlerLoader, schema);
    }

    post(path: string, handlerLoader: () => Promise<Handler> | Handler, schema?: any): this {
        return this.addRoute('POST', path, handlerLoader, schema);
    }

    put(path: string, handlerLoader: () => Promise<Handler> | Handler, schema?: any): this {
        return this.addRoute('PUT', path, handlerLoader, schema);
    }

    delete(path: string, handlerLoader: () => Promise<Handler> | Handler, schema?: any): this {
        return this.addRoute('DELETE', path, handlerLoader, schema);
    }

    patch(path: string, handlerLoader: () => Promise<Handler> | Handler, schema?: any): this {
        return this.addRoute('PATCH', path, handlerLoader, schema);
    }

    group(prefix: string, callback: (router: LazyRouter) => void): this {
        const groupRouter = new LazyRouter(this.container);
        groupRouter.middlewares = [...this.middlewares];
        callback(groupRouter);
        
        // Merge group routes with prefix
        for (const [method, routes] of groupRouter.routes) {
            if (!this.routes.has(method)) {
                this.routes.set(method, []);
            }
            for (const route of routes) {
                this.routes.get(method)!.push({
                    ...route,
                    path: prefix + route.path
                });
            }
        }
        return this;
    }

    private matchRoute(method: string, pathname: string): LazyRouteDefinition | null {
        const routes = this.routes.get(method);
        if (!routes) return null;

        for (const route of routes) {
            if (this.isPathMatch(route.path, pathname)) {
                return route;
            }
        }
        return null;
    }

    private isPathMatch(routePath: string, pathname: string): boolean {
        const routeParts = routePath.split('/').filter(Boolean);
        const pathParts = pathname.split('/').filter(Boolean);

        if (routeParts.length !== pathParts.length) return false;

        for (let i = 0; i < routeParts.length; i++) {
            const routePart = routeParts[i];
            const pathPart = pathParts[i];

            if (routePart.startsWith(':')) {
                continue;
            } else if (routePart !== pathPart) {
                return false;
            }
        }
        return true;
    }

    private extractParams(routePath: string, pathname: string): Record<string, string> {
        const routeParts = routePath.split('/').filter(Boolean);
        const pathParts = pathname.split('/').filter(Boolean);
        const params: Record<string, string> = {};

        for (let i = 0; i < routeParts.length; i++) {
            if (routeParts[i].startsWith(':')) {
                params[routeParts[i].slice(1)] = pathParts[i];
            }
        }
        return params;
    }

    private parseQuery(searchParams: URLSearchParams): Record<string, any> {
        const query: Record<string, any> = {};
        searchParams.forEach((value, key) => {
            if (key in query) {
                if (Array.isArray(query[key])) {
                    query[key].push(value);
                } else {
                    query[key] = [query[key], value];
                }
            } else {
                query[key] = value;
            }
        });
        return query;
    }

    private async parseBody(request: Request): Promise<any> {
        const contentType = request.headers.get('content-type') || '';
        
        if (contentType.includes('application/json')) {
            return await request.json();
        }
        
        if (contentType.includes('application/x-www-form-urlencoded')) {
            const formData = await request.formData();
            const body: Record<string, any> = {};
            formData.forEach((value, key) => {
                body[key] = value;
            });
            return body;
        }
        
        if (contentType.includes('multipart/form-data')) {
            return await request.formData();
        }
        
        return await request.text();
    }

    private validateSchema(schema: any, data: any): { valid: boolean; errors?: string[] } {
        if (!schema) return { valid: true };
        
        if (schema.type === 'object' && schema.properties) {
            const errors: string[] = [];
            for (const [key, propSchema] of Object.entries(schema.properties)) {
                const prop = propSchema as any;
                const value = data?.[key];
                
                if (prop.type === 'string' && value !== undefined && typeof value !== 'string') {
                    errors.push(`${key} must be a string`);
                }
                if (prop.type === 'number' && value !== undefined && typeof value !== 'number') {
                    errors.push(`${key} must be a number`);
                }
                if (prop.type === 'boolean' && value !== undefined && typeof value !== 'boolean') {
                    errors.push(`${key} must be a boolean`);
                }
                if (prop.type === 'array' && value !== undefined && !Array.isArray(value)) {
                    errors.push(`${key} must be an array`);
                }
                if (!prop.optional && value === undefined) {
                    errors.push(`${key} is required`);
                }
            }
            return { valid: errors.length === 0, errors };
        }
        
        return { valid: true };
    }

    async handle(request: Request, env: Env): Promise<Response> {
        const url = new URL(request.url);
        const method = request.method;
        const pathname = url.pathname;

        // Find matching route
        const route = this.matchRoute(method, pathname);
        if (!route) {
            return new Response('Not Found', { status: 404 });
        }

        // Lazy load handler on first match
        if (!route.loaded) {
            route.handler = await route.handlerLoader();
            route.loaded = true;
        }

        const params = this.extractParams(route.path, pathname);

        // Build context with lazy container
        const context: Context = {
            request,
            url,
            params,
            query: this.parseQuery(url.searchParams),
            headers: {},
            body: null,
            store: {},
            set: {
                status: 200,
                headers: new Headers()
            },
            cookie: {},
            jwt: undefined,
            oauth2: undefined,
            uid: undefined,
            admin: false,
            username: undefined
        };

        // Parse headers
        request.headers.forEach((value, key) => {
            context.headers[key.toLowerCase()] = value;
        });

        // Parse body for POST/PUT/PATCH
        if (['POST', 'PUT', 'PATCH'].includes(method)) {
            try {
                context.body = await this.parseBody(request);
            } catch (e) {
                // Body parsing failed, continue without body
            }
        }

        // Validate schema
        if (route.schema) {
            const validation = this.validateSchema(route.schema, context.body);
            if (!validation.valid) {
                return new Response(JSON.stringify({ errors: validation.errors }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' }
                });
            }
        }

        // Run middlewares with lazy container access
        for (const middleware of this.middlewares) {
            const result = await middleware(context, env, this.container);
            if (result instanceof Response) {
                return result;
            }
        }

        // Run handler
        try {
            const result = await route.handler!(context);
            
            if (result instanceof Response) {
                return result;
            }
            
            const headers = new Headers(context.set.headers);
            headers.set('Content-Type', 'application/json');
            
            return new Response(JSON.stringify(result), {
                status: context.set.status,
                headers
            });
        } catch (error) {
            console.error('Handler error:', error);
            return new Response('Internal Server Error', { status: 500 });
        }
    }
}

export function createLazyRouter(container: LazyContainer): LazyRouter {
    return new LazyRouter(container);
}
