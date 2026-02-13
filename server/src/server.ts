import type { DrizzleD1Database } from "drizzle-orm/d1";
import { createBaseApp } from "./core/base";
import { Router } from "./core/router";

export type DB = DrizzleD1Database<typeof import("./db/schema")>

// Service loader type - simple prefix matching instead of regex
interface ServiceLoader {
    prefix: string;
    loader: () => Promise<(router: Router) => void>;
}

// Service registry - order matters (longer prefixes first for specificity)
const serviceRegistry: ServiceLoader[] = [
    // AI Config
    {
        prefix: '/ai-config',
        loader: async () => {
            const { AIConfigService } = await import('./services/ai-config');
            return AIConfigService;
        }
    },
    // Config
    {
        prefix: '/config',
        loader: async () => {
            const { ConfigService } = await import('./services/config');
            return ConfigService;
        }
    },
    // Comment (more specific than feed)
    {
        prefix: '/comment',
        loader: async () => {
            const { CommentService } = await import('./services/comments');
            return CommentService;
        }
    },
    // Feed
    {
        prefix: '/feed',
        loader: async () => {
            const { FeedService } = await import('./services/feed');
            return FeedService;
        }
    },
    // Search (separate from feed)
    {
        prefix: '/search',
        loader: async () => {
            const { FeedService } = await import('./services/feed');
            return FeedService;
        }
    },
    // WordPress import
    {
        prefix: '/wp',
        loader: async () => {
            const { FeedService } = await import('./services/feed');
            return FeedService;
        }
    },
    // Tag
    {
        prefix: '/tag',
        loader: async () => {
            const { TagService } = await import('./services/tag');
            return TagService;
        }
    },
    // Storage
    {
        prefix: '/storage',
        loader: async () => {
            const { StorageService } = await import('./services/storage');
            return StorageService;
        }
    },
    // Friend
    {
        prefix: '/friend',
        loader: async () => {
            const { FriendService } = await import('./services/friends');
            return FriendService;
        }
    },
    // SEO
    {
        prefix: '/seo',
        loader: async () => {
            const { SEOService } = await import('./services/seo');
            return SEOService;
        }
    },
    // RSS Feeds - now served from root path (native RSS support)
    // Matches: /rss.xml, /atom.xml, /feed.json, /feed.xml (legacy)
    {
        prefix: '/rss.xml',
        loader: async () => {
            const { RSSService } = await import('./services/rss');
            return RSSService;
        }
    },
    {
        prefix: '/atom.xml',
        loader: async () => {
            const { RSSService } = await import('./services/rss');
            return RSSService;
        }
    },
    {
        prefix: '/rss.json',
        loader: async () => {
            const { RSSService } = await import('./services/rss');
            return RSSService;
        }
    },
    {
        prefix: '/feed.json',
        loader: async () => {
            const { RSSService } = await import('./services/rss');
            return RSSService;
        }
    },
    // Legacy RSS sub path support (for backward compatibility)
    {
        prefix: '/sub',
        loader: async () => {
            const { RSSService } = await import('./services/rss');
            return RSSService;
        }
    },
    // Moments
    {
        prefix: '/moments',
        loader: async () => {
            const { MomentsService } = await import('./services/moments');
            return MomentsService;
        }
    },
    // Favicon
    {
        prefix: '/favicon',
        loader: async () => {
            const { FaviconService } = await import('./services/favicon');
            return FaviconService;
        }
    },
    // User
    {
        prefix: '/user',
        loader: async () => {
            const { UserService } = await import('./services/user');
            return UserService;
        }
    },
    // Auth (password login)
    {
        prefix: '/auth',
        loader: async () => {
            const { PasswordAuthService } = await import('./services/auth');
            return PasswordAuthService;
        }
    },
];

// Find matching services for a path using simple prefix matching
function findMatchingServices(pathname: string): ServiceLoader[] {
    // Sort by prefix length (descending) to match more specific paths first
    const sorted = [...serviceRegistry].sort((a, b) => b.prefix.length - a.prefix.length);
    
    // Find the first matching service
    for (const service of sorted) {
        if (pathname === service.prefix || pathname.startsWith(service.prefix + '/')) {
            return [service];
        }
    }
    
    return [];
}

// Create app with lazy-loaded services
export async function createApp(env: Env, pathname: string): Promise<Router | null> {
    const matchingServices = findMatchingServices(pathname);
    
    if (matchingServices.length === 0) {
        return null;
    }
    
    const app = createBaseApp(env);
    
    // Load and register the first matching service
    // (each service registers its own routes via router.group())
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
