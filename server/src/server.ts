import cors from '@elysiajs/cors';
import { serverTiming } from '@elysiajs/server-timing';
import { Elysia } from 'elysia';
import type { DB } from './_worker';
import type { Env } from './db/db';
import { CommentService } from './services/comments';
import { CronService } from './services/cron';
import { FeedService } from './services/feed';
import { FriendService } from './services/friends';
import { TagService } from './services/tag';
import { UserService } from './services/user';

export const app = (db: DB, env: Env) => new Elysia({ aot: false })
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
    .use(CronService(db))
    // .use(StorageService(db, env))
    .use(UserService(db, env))
    .use(FeedService(db, env))
    .use(CommentService(db, env))
    .use(TagService(db))
    .use(FriendService(db, env))
    .get('/', () => `Hi`)
    .onError(({ path, params, code }) => {
        if (code === 'NOT_FOUND')
            return `${path} ${JSON.stringify(params)} not found`
    })
    // .listen(process.env.PORT ?? 3001, () => {
    //     if (process.env.NODE_ENV != 'test')
    //         console.info(`[Rim] Server is running on port ${process.env.PORT ?? 3001}`)
    // })

export type App = typeof app