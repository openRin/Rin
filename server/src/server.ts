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


const app = base()
    .use(UserService)
    .use(FaviconService)
    .use(FeedService)
    .use(CommentService)
    .use(TagService)
    .use(StorageService)
    .use(FriendService)
    .use(SEOService)
    .use(RSSService)
    .use(ConfigService)
    .use(AIConfigService)
    .use(MomentsService)
    .get('/', () => `Hi`)
    .onError(({ path, params, code }) => {
        if (code === 'NOT_FOUND')
            return `${path} ${JSON.stringify(params)} not found`
    })
    .compile()


export default app