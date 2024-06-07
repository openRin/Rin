import Elysia from "elysia";
import path from "node:path";
import type { DB } from "../_worker";
import type { Env } from "../db/db";
import { setup } from "../setup";

export const SEOService = (db: DB, env: Env) => {
    const endpoint = env.S3_ENDPOINT;
    const accessHost = env.S3_ACCESS_HOST || endpoint;
    const folder = env.S3_CACHE_FOLDER || 'cache/';
    if (!accessHost) {
        throw new Error('S3_ACCESS_HOST is not defined');
    }
    return new Elysia({ aot: false })
        .use(setup(db, env))
        .get('/seo/*', async ({ set, params, query }) => {
            let url = params['*'];
            // query concat
            for (const key in query) {
                url += `&${key}=${query[key]}`;
            }
            const key = path.join(folder, url);
            try {
                const url = `${accessHost}/${key}`;
                console.log(`Fetching ${url}`);
                const response = await fetch(new Request(url))
                return new Response(response.body, {
                    status: response.status,
                    statusText: response.statusText,
                });
            } catch (e: any) {
                console.error(e);
                set.status = 500;
                return e.message;
            }
        })
}
