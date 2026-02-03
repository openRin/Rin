// Compatibility layer to bridge Elysia-style services to lightweight framework
import { Router } from "./router";
import { t } from "./types";

// Re-export t for schema definitions
export { t };

// Adapter function to convert Elysia-style service to lightweight router
export function adaptService(
    serviceFactory: () => any
): (router: Router) => void {
    return (router: Router) => {
        // The service factory returns an Elysia-like object with routes
        // We need to extract and register them on our router
        const service = serviceFactory();
        
        // If the service has routes property (from our router), it's already compatible
        if (service instanceof Router) {
            // Merge routes from service into target router
            for (const [method, routes] of service['routes']) {
                for (const route of routes) {
                    (router as any).addRoute(method, route.path, route.handler, route.schema);
                }
            }
        }
    };
}

// Helper to create Elysia-compatible base
export function createElysiaCompatibleBase(env: Env) {
    // This returns a mock Elysia-like object that services can use
    return {
        group: function(prefix: string, callback: (group: any) => any) {
            return this;
        },
        get: function(path: string, handler: any, schema?: any) {
            return this;
        },
        post: function(path: string, handler: any, schema?: any) {
            return this;
        },
        put: function(path: string, handler: any, schema?: any) {
            return this;
        },
        delete: function(path: string, handler: any, schema?: any) {
            return this;
        },
        use: function(plugin: any) {
            return this;
        },
        state: function(key: string, value: any) {
            return this;
        },
        derive: function(options: any, handler: any) {
            return this;
        }
    };
}
