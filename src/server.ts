import cors from '@elysiajs/cors';
import { Elysia } from 'elysia';
import { Logestic } from 'logestic';
import { PostService } from './action/post';
import { UserService } from './action/user';
import { migration } from './db/migrate';

migration()

const log = Logestic.preset('fancy')
export const app = new Elysia()
    .use(cors())
    .use(log)
    .use(UserService)
    .use(PostService)
    .get('/', ({uid}) => `Hi ${uid}`)
    .onError(({ code }) => {
        if (code === 'NOT_FOUND')
            return ':('
    })
    .listen(process.env.PORT ?? 3001)

export type App = typeof app