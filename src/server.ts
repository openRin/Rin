import cors from '@elysiajs/cors';
import { Elysia } from 'elysia';
import { PostService } from './action/post';
import { UserService } from './action/user';
import { migration } from './db/migrate';
import { elysiaVite } from './static/vite';
import { logPlugin, logger } from './utils/logger';

migration()
const webui = elysiaVite({
    base: '/app',
    viteConfigFile: `${import.meta.dir}/vite.config.ts`,
    entryHtmlFile: `${import.meta.dir}/client/index.html`,
    entryClientFile: `${import.meta.dir}/client/main.tsx`,
    isReact: true,
    placeHolderDevScripts: '<!--vite-dev-scripts-->',
    server: {
        host: process.env.VITE_HOST,
    },
})
export const app = new Elysia()
    .use(cors())
    .use(logPlugin)
    .use(UserService)
    .use(PostService)
    .get('/', ({ uid }) => `Hi ${uid}`)
    .use(webui)
    .onError(({ code }) => {
        if (code === 'NOT_FOUND')
            return ':('
    })
    .listen(process.env.PORT ?? 3001, () => {
        logger.info(`[Rim] Server is running: http://localhost:${process.env.PORT ?? 3001}`)
    })

export type App = typeof app