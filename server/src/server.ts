import cors from '@elysiajs/cors';
import { serverTiming } from '@elysiajs/server-timing';
import { Elysia } from 'elysia';
import { CronService } from './services/cron';
import { FeedService } from './services/feed';
import { FriendService } from './services/friends';
import { StorageService } from './services/storage';
import { TagService } from './services/tag';
import { UserService } from './services/user';
import { logPlugin, logger } from './utils/logger';
import { CommentService } from './services/comments';

export const app = new Elysia()
    .use(cors({
        aot: true,
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
    .use(CronService)
    .use(logPlugin)
    .use(StorageService)
    .use(UserService)
    .use(FeedService)
    .use(CommentService)
    .use(TagService)
    .use(FriendService)
    .get('/', () => `Hi`)
    .onError(({ path, params, code }) => {
        if (code === 'NOT_FOUND')
            return `${path} ${JSON.stringify(params)} not found`
    })
    .listen(process.env.PORT ?? 3001, () => {
        if (process.env.NODE_ENV != 'test')
            logger.info(`[Rim] Server is running on port ${process.env.PORT ?? 3001}`)
    })

export type App = typeof app