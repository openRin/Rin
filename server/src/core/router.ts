import type { Context, Handler, Middleware, RouteDefinition } from "./types";
import { handleError, generateRequestId } from "./error-handler";
import { isAppError } from "../errors";

export class Router {
    private routes: Map<string, RouteDefinition[]> = new Map();
    private middlewares: Middleware[] = [];
    private appState: Map<string, any> = new Map();

    use(middleware: Middleware): this {
        this.middlewares.push(middleware);
        return this;
    }

    state<T>(key: string, value: T): this {
        this.appState.set(key, value);
        return this;
    }

    private addRoute(method: string, path: string, handler: Handler, schema?: any): this {
        if (!this.routes.has(method)) {
            this.routes.set(method, []);
        }
        this.routes.get(method)!.push({ path, handler, schema });
        return this;
    }

    get(path: string, handler: Handler, schema?: any): this {
        return this.addRoute('GET', path, handler, schema);
    }

    post(path: string, handler: Handler, schema?: any): this {
        return this.addRoute('POST', path, handler, schema);
    }

    put(path: string, handler: Handler, schema?: any): this {
        return this.addRoute('PUT', path, handler, schema);
    }

    delete(path: string, handler: Handler, schema?: any): this {
        return this.addRoute('DELETE', path, handler, schema);
    }

    patch(path: string, handler: Handler, schema?: any): this {
        return this.addRoute('PATCH', path, handler, schema);
    }

    group(prefix: string, callback: (router: Router) => void): this {
        const groupRouter = new Router();
        groupRouter.middlewares = [...this.middlewares];
        groupRouter.appState = new Map(this.appState);
        callback(groupRouter);
        
        // Merge group routes with prefix
        for (const [method, routes] of groupRouter.routes) {
            if (!this.routes.has(method)) {
                this.routes.set(method, []);
            }
            for (const route of routes) {
                this.routes.get(method)!.push({
                    path: prefix + route.path,
                    handler: route.handler,
                    schema: route.schema
                });
            }
        }
        return this;
    }

    private matchRoute(method: string, pathname: string): { route: RouteDefinition; params: Record<string, string> } | null {
        const routes = this.routes.get(method);
        if (!routes) return null;

        for (const route of routes) {
            const params = this.extractParams(route.path, pathname);
            if (params !== null) {
                return { route, params };
            }
        }
        return null;
    }

    private extractParams(routePath: string, pathname: string): Record<string, string> | null {
        const routeParts = routePath.split('/').filter(Boolean);
        const pathParts = pathname.split('/').filter(Boolean);

        if (routeParts.length !== pathParts.length) return null;

        const params: Record<string, string> = {};
        for (let i = 0; i < routeParts.length; i++) {
            const routePart = routeParts[i];
            const pathPart = pathParts[i];

            if (routePart.startsWith(':')) {
                params[routePart.slice(1)] = pathPart;
            } else if (routePart !== pathPart) {
                return null;
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
        
        // Simple TypeBox-like validation
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
        const requestId = generateRequestId();

        // Handle OPTIONS preflight requests before route matching
        if (method === 'OPTIONS') {
            const origin = request.headers.get('origin') || '*';
            const headers = new Headers();
            headers.set('Access-Control-Allow-Origin', origin);
            headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
            headers.set('Access-Control-Allow-Headers', 'content-type, x-csrf-token');
            headers.set('Access-Control-Max-Age', '600');
            headers.set('Access-Control-Allow-Credentials', 'true');
            return new Response(null, { status: 204, headers });
        }

        // Find matching route
        const match = this.matchRoute(method, pathname);
        if (!match) {
            const errorResponse = {
                success: false,
                error: {
                    code: 'NOT_FOUND',
                    message: `Route ${method} ${pathname} not found`,
                    requestId,
                },
            };
            return new Response(JSON.stringify(errorResponse), {
                status: 404,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const { route, params } = match;

        // Build context
        const context: Context = {
            request,
            url,
            params,
            query: this.parseQuery(url.searchParams),
            headers: {},
            body: null,
            store: Object.fromEntries(this.appState.entries()),
            set: {
                status: 200,
                headers: new Headers()
            },
            cookie: {},
            jwt: this.appState.get('jwt'),
            oauth2: this.appState.get('oauth2'),
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
                // Body parsing failed, return structured error
                const { ValidationError } = await import('../errors');
                return handleError(
                    new ValidationError('Invalid request body format'),
                    context,
                    requestId
                );
            }
        }

        // Validate schema
        if (route.schema) {
            const validation = this.validateSchema(route.schema, context.body);
            if (!validation.valid) {
                const { ValidationError } = await import('../errors');
                const details = validation.errors?.map((msg) => ({ message: msg }));
                return handleError(
                    new ValidationError('Validation failed', details),
                    context,
                    requestId
                );
            }
        }

        // Run middlewares
        try {
            for (const middleware of this.middlewares) {
                const result = await middleware(context, env);
                if (result instanceof Response) {
                    return result;
                }
            }
        } catch (error) {
            return handleError(error, context, requestId);
        }

        // Run handler
        try {
            const result = await route.handler(context);
            
            // Handle different response types
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
            return handleError(error, context, requestId);
        }
    }
}

export function createRouter(): Router {
    return new Router();
}
