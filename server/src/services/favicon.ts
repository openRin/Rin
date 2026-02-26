import { Hono } from "hono";
import { startTime, endTime } from "hono/timing";
import type { AppContext } from "../core/hono-types";
import { path_join } from "../utils/path";
import { createS3Client, putObject } from "../utils/s3";

// @see https://developers.cloudflare.com/images/url-format#supported-formats-and-limitations
export const FAVICON_ALLOWED_TYPES: { [key: string]: string } = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/gif": ".gif",
    "image/webp": ".webp",
};

export function getFaviconKey(env: Env) {
    return path_join(env.S3_FOLDER || "", "favicon.webp");
}

export function FaviconService(): Hono {
    const app = new Hono();

    // GET /favicon
    app.get("/", async (c: AppContext) => {
        startTime(c, 'favicon-get');
        const env = c.get('env');
        const accessHost = env.S3_ACCESS_HOST || env.S3_ENDPOINT;
        const faviconKey = getFaviconKey(env);
        
        try {
            startTime(c, 's3-fetch');
            const response = await fetch(new Request(`${accessHost}/${faviconKey}`));
            endTime(c, 's3-fetch');

            if (!response.ok) {
                endTime(c, 'favicon-get');
                c.status(response.status as 200 | 400 | 401 | 403 | 404 | 500);
                return c.text(await response.text());
            }

            c.header("Content-Type", "image/webp");
            c.header("Cache-Control", "public, max-age=31536000");

            const body = await response.arrayBuffer();
            endTime(c, 'favicon-get');
            return c.body(body);
        } catch (error) {
            if (error instanceof Error) {
                endTime(c, 'favicon-get');
                c.status(500);
                console.error("Error fetching favicon:", error);
                return c.text(`Error fetching favicon: ${error.message}`);
            }
        }
    });

    // GET /favicon/original
    app.get("/original", async (c: AppContext) => {
        startTime(c, 'favicon-original-get');
        const env = c.get('env');
        const accessHost = env.S3_ACCESS_HOST || env.S3_ENDPOINT;
        
        try {
            let originFaviconKey = null;
            for (const [mimeType, ext] of Object.entries(FAVICON_ALLOWED_TYPES)) {
                originFaviconKey = path_join(env.S3_FOLDER || "", `originFavicon${ext}`);
                startTime(c, 's3-fetch-original');
                const response = await fetch(new Request(`${accessHost}/${originFaviconKey}`));
                endTime(c, 's3-fetch-original');

                if (response.ok) {
                    c.header("Content-Type", mimeType);
                    c.header("Cache-Control", "public, max-age=31536000");
                    const body = await response.arrayBuffer();
                    endTime(c, 'favicon-original-get');
                    return c.body(body);
                }
            }

            endTime(c, 'favicon-original-get');
            c.status(404);
            return c.text("Original favicon not found");
        } catch (error) {
            if (error instanceof Error) {
                endTime(c, 'favicon-original-get');
                c.status(500);
                console.error("Error fetching original favicon:", error);
                return c.text(`Error fetching original favicon: ${error.message}`);
            }
        }
    });

    // POST /favicon
    app.post("/", async (c: AppContext) => {
        startTime(c, 'favicon-upload');
        const env = c.get('env');
        const admin = c.get('admin');
        
        const s3 = createS3Client(env);
        const accessHost = env.S3_ACCESS_HOST || env.S3_ENDPOINT;
        const faviconKey = getFaviconKey(env);
        
        try {
            if (!admin) {
                endTime(c, 'favicon-upload');
                c.status(403);
                return c.text("Permission denied");
            }

            const body = await c.req.parseBody();
            const file = body.file as File;
            
            if (!file) {
                endTime(c, 'favicon-upload');
                c.status(400);
                return c.text("No file uploaded");
            }

            const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
            if (file.size > MAX_FILE_SIZE) {
                endTime(c, 'favicon-upload');
                c.status(400);
                return c.text(`File size exceeds limit (${MAX_FILE_SIZE / 1024 / 1024}MB)`);
            }

            if (!FAVICON_ALLOWED_TYPES[file.type]) {
                endTime(c, 'favicon-upload');
                c.status(400);
                return c.text("Disallowed file type");
            }
            
            const originFaviconKey = path_join(
                env.S3_FOLDER || "",
                `originFavicon${FAVICON_ALLOWED_TYPES[file.type]}`,
            );

            startTime(c, 's3-put-origin');
            await putObject(
                s3,
                env,
                originFaviconKey,
                file
            );
            endTime(c, 's3-put-origin');

            const imageRequest = new Request(`${accessHost}/${originFaviconKey}`, {
                headers: c.req.raw.headers,
            });

            startTime(c, 'cf-image-resize');
            const response = await fetch(imageRequest, {
                cf: {
                    image: {
                        width: 144,
                        height: 144,
                        fit: "cover",
                        format: "webp",
                        quality: 100,
                    },
                },
            });
            endTime(c, 'cf-image-resize');

            if (!response.ok) {
                endTime(c, 'favicon-upload');
                c.status(response.status as 200 | 400 | 401 | 403 | 404 | 500);
                return c.text(await response.text());
            }

            const arrayBuffer = await response.arrayBuffer();

            startTime(c, 's3-put-resized');
            await putObject(
                s3,
                env,
                faviconKey,
                new Uint8Array(arrayBuffer)
            );
            endTime(c, 's3-put-resized');

            endTime(c, 'favicon-upload');
            return c.json({ url: `${accessHost}/${faviconKey}` });
        } catch (error) {
            if (error instanceof Error) {
                endTime(c, 'favicon-upload');
                c.status(500);
                console.error("Error processing favicon:", error);
                return c.text(`Error processing favicon: ${error.message}`);
            }
        }
    });

    return app;
}
