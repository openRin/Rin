import cors from '@elysiajs/cors';
import { serverTiming } from '@elysiajs/server-timing';
import { Elysia } from 'elysia';
import type { DB } from './_worker';
import type { Env } from './db/db';
import { CommentService } from './services/comments';
import { FeedService } from './services/feed';
import { FriendService } from './services/friends';
import { TagService } from './services/tag';
import { UserService } from './services/user';
import { StorageService } from './services/storage';
import { SEOService } from './services/seo';

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
    .use(UserService(db, env))
    .use(FeedService(db, env))
    .use(CommentService(db, env))
    .use(TagService(db))
    .use(StorageService(db, env))
    .use(FriendService(db, env))
    .use(SEOService(db, env))
    .get('/', () => `Hi`)
    .onError(({ path, params, code }) => {
        if (code === 'NOT_FOUND')
            return `${path} ${JSON.stringify(params)} not found`
    })

export type App = ReturnType<typeof app>;