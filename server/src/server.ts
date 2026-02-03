import type { DrizzleD1Database } from "drizzle-orm/d1";
import { createBaseApp } from "./core/base";
import { Router } from "./core/router";

export type DB = DrizzleD1Database<typeof import("./db/schema")>

// Service loader type
interface ServiceLoader {
    pattern: RegExp;
    loader: () => Promise<(router: Router) => void>;
}

// Service registry - order matters (more specific patterns first)
const serviceRegistry: ServiceLoader[] = [
    // AI Config
    {
        pattern: /^\/ai-config/,
        loader: async () => {
            const { AIConfigService } = await import('./services/ai-config');
            return AIConfigService;
        }
    },
    // Config
    {
        pattern: /^\/config/,
        loader: async () => {
            const { ConfigService } = await import('./services/config');
            return ConfigService;
        }
    },
    // Feed Comments (more specific than feed)
    {
        pattern: /^\/feed\/comment/,
        loader: async () => {
            const { CommentService } = await import('./services/comments');
            return CommentService;
        }
    },
    // Comment delete (standalone)
    {
        pattern: /^\/comment/,
        loader: async () => {
            const { CommentService } = await import('./services/comments');
            return CommentService;
        }
    },
    // Feed
    {
        pattern: /^\/feed/,
        loader: async () => {
            const { FeedService } = await import('./services/feed');
            return FeedService;
        }
    },
    // Search (separate from feed)
    {
        pattern: /^\/search/,
        loader: async () => {
            const { FeedService } = await import('./services/feed');
            return FeedService;
        }
    },
    // WordPress import
    {
        pattern: /^\/wp/,
        loader: async () => {
            const { FeedService } = await import('./services/feed');
            return FeedService;
        }
    },
    // Tag
    {
        pattern: /^\/tag/,
        loader: async () => {
            const { TagService } = await import('./services/tag');
            return TagService;
        }
    },
    // Storage
    {
        pattern: /^\/storage/,
        loader: async () => {
            const { StorageService } = await import('./services/storage');
            return StorageService;
        }
    },
    // Friend
    {
        pattern: /^\/friend/,
        loader: async () => {
            const { FriendService } = await import('./services/friends');
            return FriendService;
        }
    },
    // SEO
    {
        pattern: /^\/seo/,
        loader: async () => {
            const { SEOService } = await import('./services/seo');
            return SEOService;
        }
    },
    // RSS/Sub
    {
        pattern: /^\/sub/,
        loader: async () => {
            const { RSSService } = await import('./services/rss');
            return RSSService;
        }
    },
    // Moments
    {
        pattern: /^\/moments/,
        loader: async () => {
            const { MomentsService } = await import('./services/moments');
            return MomentsService;
        }
    },
    // Favicon
    {
        pattern: /^\/favicon/,
        loader: async () => {
            const { FaviconService } = await import('./services/favicon');
            return FaviconService;
        }
    },
    // User
    {
        pattern: /^\/user/,
        loader: async () => {
            const { UserService } = await import('./services/user');
            return UserService;
        }
    },
];

// Find matching services for a path
function findMatchingServices(pathname: string): ServiceLoader[] {
    return serviceRegistry.filter(service => service.pattern.test(pathname));
}

// Create app with lazy-loaded services
export async function createApp(env: Env, pathname: string): Promise<Router | null> {
    const matchingServices = findMatchingServices(pathname);
    
    if (matchingServices.length === 0) {
        return null;
    }
    
    const app = createBaseApp(env);
    
    // Load and register all matching services
    for (const service of matchingServices) {
        const serviceFn = await service.loader();
        serviceFn(app);
    }
    
    return app;
}

// Default health check route
export function createDefaultApp(env: Env) {
    const app = createBaseApp(env);
    app.get('/', () => 'Hi');
    return app;
}
