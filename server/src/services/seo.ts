import Elysia from "elysia";
import path from "node:path";
import type { Env } from "../db/db";
import { getEnv } from "../utils/di";

export function SEOService() {
    const env: Env = getEnv();
    const endpoint = env.S3_ENDPOINT;
    const accessHost = env.S3_ACCESS_HOST || endpoint;
    const folder = env.S3_CACHE_FOLDER || 'cache/';
    return new Elysia({ aot: false })
        .get('/seo/*', async ({ set, params, query }) => {
            if (!accessHost) {
                set.status = 500;
                return 'S3_ACCESS_HOST is not defined'
            }
            let url = params['*'];
            // query concat
            for (const key in query) {
                url += `&${key}=${query[key]}`;
            }
            if (url.endsWith('/') || url === '') {
                url += 'index.html';
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
