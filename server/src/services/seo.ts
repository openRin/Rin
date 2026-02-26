import { Hono } from "hono";
import { startTime, endTime } from "hono/timing";
import type { AppContext } from "../core/hono-types";
import { path_join } from "../utils/path";

export function SEOService(): Hono {
    const app = new Hono();
    
    app.get('*', async (c: AppContext) => {
        startTime(c, 'seo-route');
        const env = c.get('env');

        const endpoint = env.S3_ENDPOINT;
        const accessHost = env.S3_ACCESS_HOST || endpoint;
        const folder = env.S3_CACHE_FOLDER || 'cache/';

        if (!accessHost) {
            endTime(c, 'seo-route');
            return c.text('S3_ACCESS_HOST is not defined', 500);
        }

        let url = c.req.param('*');
        const query = c.req.query();

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
            startTime(c, 's3-fetch');
            const response = await fetch(new Request(fullUrl));
            endTime(c, 's3-fetch');
            endTime(c, 'seo-route');
            return new Response(response.body, {
                status: response.status,
                statusText: response.statusText,
            });
        } catch (e: any) {
            console.error(e);
            endTime(c, 'seo-route');
            return c.text(e.message, 500);
        }
    });
    
    return app;
}
