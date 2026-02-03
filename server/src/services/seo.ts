import { Router } from "../core/router";
import type { Context } from "../core/types";
import { path_join } from "../utils/path";

export function SEOService(router: Router): void {
    router.get('/seo/*', async (ctx: Context) => {
        const { set, params, query, store: { env } } = ctx;
        
        const endpoint = env.S3_ENDPOINT;
        const accessHost = env.S3_ACCESS_HOST || endpoint;
        const folder = env.S3_CACHE_FOLDER || 'cache/';
        
        if (!accessHost) {
            set.status = 500;
            return 'S3_ACCESS_HOST is not defined';
        }
        
        let url = params['*'];
        
        // query concat
        for (const key in query) {
            url += `&${key}=${query[key]}`;
        }
        
        if (url.endsWith('/') || url === '') {
            url += 'index.html';
        }
        
        const key = path_join(folder, url);
        
        try {
            const fullUrl = `${accessHost}/${key}`;
            console.log(`Fetching ${fullUrl}`);
            const response = await fetch(new Request(fullUrl));
            return new Response(response.body, {
                status: response.status,
                statusText: response.statusText,
            });
        } catch (e: any) {
            console.error(e);
            set.status = 500;
            return e.message;
        }
    });
}
