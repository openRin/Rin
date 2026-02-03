import { createBaseApp } from "./core/base";
import { AIConfigService } from './services/ai-config';
import { CommentService } from './services/comments';
import { ConfigService } from './services/config';
import { FaviconService } from "./services/favicon";
import { FeedService } from './services/feed';
import { FriendService } from './services/friends';
import { MomentsService } from './services/moments';
import { RSSService } from './services/rss';
import { SEOService } from './services/seo';
import { StorageService } from './services/storage';
import { TagService } from './services/tag';
import { UserService } from './services/user';
import { getFirstPathSegment } from './utils/path';

// Service registry - lazy load services based on path
export function createApp(env: Env, path: string) {
    const group = getFirstPathSegment(path);
    const app = createBaseApp(env);
    
    switch (group) {
        case 'ai-config':
            AIConfigService(app);
            break;
        case 'config':
            ConfigService(app);
            break;
        case 'feed':
            FeedService(app);
            CommentService(app);
            break;
        case 'tag':
            TagService(app);
            break;
        case 'storage':
            StorageService(app);
            break;
        case 'friend':
            FriendService(app);
            break;
        case 'seo':
            SEOService(app);
            break;
        case 'sub':
            RSSService(app);
            break;
        case 'moments':
            MomentsService(app);
            break;
        case 'favicon':
            FaviconService(app);
            break;
        case 'user':
            UserService(app);
            break;
        default:
            return null;
    }
    
    return app;
}

// Default health check route
export function createDefaultApp(env: Env) {
    const app = createBaseApp(env);
    app.get('/', () => 'Hi');
    return app;
}
