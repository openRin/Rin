import cors from '@elysiajs/cors';
import { Elysia } from 'elysia';
import { PostService } from './action/post';
import { UserService } from './action/user';
import { migration } from './db/migrate';
import {logPlugin, logger} from './utils/logger'

migration()

export const app = new Elysia()
    .use(cors())
    .use(logPlugin)
    .use(UserService)
    .use(PostService)
    .get('/', ({ uid }) => `Hi ${uid}`)
    .onError(({ code }) => {
        if (code === 'NOT_FOUND')
            return ':('
    })
    .listen(process.env.PORT ?? 3001, () => {
        logger.info(`[Rim] Server is running: http://localhost:${process.env.PORT ?? 3001}`)
    })

export type App = typeof app