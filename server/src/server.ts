import base from './base';
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


const app = (path: string) => {
    const group = getFirstPathSegment(path);
    let services = undefined;
    switch (group) {
        case 'ai-config':
            services = [AIConfigService];
            break;
        case 'config':
            services = [ConfigService];
            break;
        case 'feed':
            services = [FeedService, CommentService];
            break;
        case 'tag':
            services = [TagService];
            break;
        case 'storage':
            services = [StorageService];
            break;
        case 'friend':
            services = [FriendService];
            break;
        case 'seo':
            services = [SEOService];
            break;
        case 'sub':
            services = [RSSService];
            break;
        case 'moments':
            services = [MomentsService];
            break;
        case 'favicon':
            services = [FaviconService];
            break;
        case 'user':
            services = [UserService];
            break;
    }
    if (services) {
        let serviceApp: any = base()
            .get('/', () => `Hi`);
        for (const service of services) {
            serviceApp = serviceApp.use(service());
        }
        return serviceApp
    }
}


export default app