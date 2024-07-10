import cors from '@elysiajs/cors';
import { serverTiming } from '@elysiajs/server-timing';
import { Elysia } from 'elysia';
import { CommentService } from './services/comments';
import { FeedService } from './services/feed';
import { FriendService } from './services/friends';
import { RSSService } from './services/rss';
import { SEOService } from './services/seo';
import { StorageService } from './services/storage';
import { TagService } from './services/tag';
import { UserService } from './services/user';
import { ConfigService } from './services/config';

export const app = () => new Elysia({ aot: false })
    .use(cors({
        aot: false,
        origin: '*',
        methods: '*',
        allowedHeaders: [
            'Authorization',
            'content-type'
        ],
        maxAge: 600,
        credentials: true,
        preflight: true
    }))
    .use(serverTiming({
        enabled: true,
    }))
    .use(UserService())
    .use(FeedService())
    .use(CommentService())
    .use(TagService())
    .use(StorageService())
    .use(FriendService())
    .use(SEOService())
    .use(RSSService())
    .use(ConfigService())
    .get('/', () => `Hi`)
    .onError(({ path, params, code }) => {
        if (code === 'NOT_FOUND')
            return `${path} ${JSON.stringify(params)} not found`
    })

export type App = ReturnType<typeof app>;