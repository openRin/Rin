import { Router } from "../core/router";
import { t } from "../core/types";
import type { Context } from "../core/types";
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

export function FaviconService(router: Router): void {
    // GET /favicon
    router.get("/favicon", async (ctx: Context) => {
        const { set, store: { env } } = ctx;
        const accessHost = env.S3_ACCESS_HOST || env.S3_ENDPOINT;
        const faviconKey = getFaviconKey(env);
        
        try {
            const response = await fetch(new Request(`${accessHost}/${faviconKey}`));

            if (!response.ok) {
                set.status = response.status;
                return await response.text();
            }

            set.headers.set("Content-Type", "image/webp");
            set.headers.set("Cache-Control", "public, max-age=31536000");

            return await response.arrayBuffer();
        } catch (error) {
            if (error instanceof Error) {
                set.status = 500;
                console.error("Error fetching favicon:", error);
                return `Error fetching favicon: ${error.message}`;
            }
        }
    });

    // GET /favicon/original
    router.get("/favicon/original", async (ctx: Context) => {
        const { set, store: { env } } = ctx;
        const accessHost = env.S3_ACCESS_HOST || env.S3_ENDPOINT;
        
        try {
            let originFaviconKey = null;
            for (const [mimeType, ext] of Object.entries(FAVICON_ALLOWED_TYPES)) {
                originFaviconKey = path_join(env.S3_FOLDER || "", `originFavicon${ext}`);
                const response = await fetch(new Request(`${accessHost}/${originFaviconKey}`));

                if (response.ok) {
                    set.headers.set("Content-Type", mimeType);
                    set.headers.set("Cache-Control", "public, max-age=31536000");
                    return await response.arrayBuffer();
                }
            }

            set.status = 404;
            return "Original favicon not found";
        } catch (error) {
            if (error instanceof Error) {
                set.status = 500;
                console.error("Error fetching original favicon:", error);
                return `Error fetching original favicon: ${error.message}`;
            }
        }
    });

    // POST /favicon
    router.post("/favicon", async (ctx: Context) => {
        const { request, set, body, admin, store: { env } } = ctx;
        const { file } = body;
        
        const s3 = createS3Client(env);
        const accessHost = env.S3_ACCESS_HOST || env.S3_ENDPOINT;
        const faviconKey = getFaviconKey(env);
        
        try {
            if (!admin) {
                set.status = 403;
                return "Permission denied";
            }

            const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
            if (file.size > MAX_FILE_SIZE) {
                set.status = 400;
                return `File size exceeds limit (${MAX_FILE_SIZE / 1024 / 1024}MB)`;
            }

            if (!FAVICON_ALLOWED_TYPES[file.type]) {
                return new Response("Disallowed file type", { status: 400 });
            }
            
            const originFaviconKey = path_join(
                env.S3_FOLDER || "",
                `originFavicon${FAVICON_ALLOWED_TYPES[file.type]}`,
            );

            await putObject(
                s3,
                env,
                originFaviconKey,
                file
            );

            const imageRequest = new Request(`${accessHost}/${originFaviconKey}`, {
                headers: request.headers,
            });

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

            if (!response.ok) {
                set.status = response.status;
                return await response.text();
            }

            const arrayBuffer = await response.arrayBuffer();

            await putObject(
                s3,
                env,
                faviconKey,
                new Uint8Array(arrayBuffer)
            );

            return { url: `${accessHost}/${faviconKey}` };
        } catch (error) {
            if (error instanceof Error) {
                set.status = 500;
                console.error("Error processing favicon:", error);
                return `Error processing favicon: ${error.message}`;
            }
        }
    }, {
        type: 'object',
        properties: {
            file: { type: 'file' }
        }
    });
}
