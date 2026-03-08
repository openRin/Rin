import { Hono } from "hono";
import type { AppContext } from "../core/hono-types";
import { profileAsync } from "../core/server-timing";
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

async function buildFaviconFromSource(c: AppContext, sourceUrl: string, faviconKey: string) {
    const env = c.get('env');
    const s3 = createS3Client(env);
    const imageRequest = new Request(sourceUrl, {
        headers: c.req.raw.headers,
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
        return response;
    }

    const arrayBuffer = await response.arrayBuffer();
    await putObject(
        s3,
        env,
        faviconKey,
        new Uint8Array(arrayBuffer),
        "image/webp",
    );

    return new Response(arrayBuffer, {
        status: 200,
        headers: {
            "Content-Type": "image/webp",
            "Cache-Control": "public, max-age=31536000",
        },
    });
}

export function FaviconService(): Hono {
    const app = new Hono();

    // GET /favicon
    app.get("/", async (c: AppContext) => {
        const env = c.get('env');
        const clientConfig = c.get('clientConfig');
        const accessHost = env.S3_ACCESS_HOST || env.S3_ENDPOINT;
        const faviconKey = getFaviconKey(env);
        
        try {
            const response = await profileAsync(c, 'favicon_fetch', () => fetch(new Request(`${accessHost}/${faviconKey}`)));

            if (!response.ok) {
                const avatar = await profileAsync(c, 'favicon_avatar', () => clientConfig.get("site.avatar")) as string | undefined;
                if (!avatar) {
                    c.status(response.status as 200 | 400 | 401 | 403 | 404 | 500);
                    return c.text(await response.text());
                }

                const avatarUrl = new URL(avatar, c.req.url).toString();
                const generatedFavicon = await profileAsync(c, 'favicon_generate', () => buildFaviconFromSource(c, avatarUrl, faviconKey));
                if (!generatedFavicon.ok) {
                    c.status(generatedFavicon.status as 200 | 400 | 401 | 403 | 404 | 500);
                    return c.text(await generatedFavicon.text());
                }

                c.header("Content-Type", generatedFavicon.headers.get("Content-Type") || "image/webp");
                c.header("Cache-Control", generatedFavicon.headers.get("Cache-Control") || "public, max-age=31536000");
                return c.body(await profileAsync(c, 'favicon_generate_body', () => generatedFavicon.arrayBuffer()));
            }

            c.header("Content-Type", "image/webp");
            c.header("Cache-Control", "public, max-age=31536000");

            return c.body(await profileAsync(c, 'favicon_body', () => response.arrayBuffer()));
        } catch (error) {
            if (error instanceof Error) {
                c.status(500);
                console.error("Error fetching favicon:", error);
                return c.text(`Error fetching favicon: ${error.message}`);
            }
        }
    });

    // GET /favicon/original
    app.get("/original", async (c: AppContext) => {
        const env = c.get('env');
        const accessHost = env.S3_ACCESS_HOST || env.S3_ENDPOINT;
        
        try {
            let originFaviconKey: string | null = null;
            for (const [mimeType, ext] of Object.entries(FAVICON_ALLOWED_TYPES)) {
                originFaviconKey = path_join(env.S3_FOLDER || "", `originFavicon${ext}`);
                const response = await profileAsync(c, 'favicon_original_fetch', () => fetch(new Request(`${accessHost}/${originFaviconKey}`)));

                if (response.ok) {
                    c.header("Content-Type", mimeType);
                    c.header("Cache-Control", "public, max-age=31536000");
                    return c.body(await profileAsync(c, 'favicon_original_body', () => response.arrayBuffer()));
                }
            }

            c.status(404);
            return c.text("Original favicon not found");
        } catch (error) {
            if (error instanceof Error) {
                c.status(500);
                console.error("Error fetching original favicon:", error);
                return c.text(`Error fetching original favicon: ${error.message}`);
            }
        }
    });

    // POST /favicon
    app.post("/", async (c: AppContext) => {
        const env = c.get('env');
        const admin = c.get('admin');
        
        const s3 = createS3Client(env);
        const accessHost = env.S3_ACCESS_HOST || env.S3_ENDPOINT;
        const faviconKey = getFaviconKey(env);
        
        try {
            if (!admin) {
                c.status(403);
                return c.text("Permission denied");
            }

            const body = await profileAsync(c, 'favicon_upload_parse', () => c.req.parseBody());
            const file = body.file as File;
            
            if (!file) {
                c.status(400);
                return c.text("No file uploaded");
            }

            const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
            if (file.size > MAX_FILE_SIZE) {
                c.status(400);
                return c.text(`File size exceeds limit (${MAX_FILE_SIZE / 1024 / 1024}MB)`);
            }

            if (!FAVICON_ALLOWED_TYPES[file.type]) {
                c.status(400);
                return c.text("Disallowed file type");
            }
            
            const originFaviconKey = path_join(
                env.S3_FOLDER || "",
                `originFavicon${FAVICON_ALLOWED_TYPES[file.type]}`,
            );

            await profileAsync(c, 'favicon_origin_put', () => putObject(
                s3,
                env,
                originFaviconKey,
                file
            ));

            const imageRequest = new Request(`${accessHost}/${originFaviconKey}`, {
                headers: c.req.raw.headers,
            });

            const response = await profileAsync(c, 'favicon_transform_fetch', () => fetch(imageRequest, {
                cf: {
                    image: {
                        width: 144,
                        height: 144,
                        fit: "cover",
                        format: "webp",
                        quality: 100,
                    },
                },
            }));

            if (!response.ok) {
                c.status(response.status as 200 | 400 | 401 | 403 | 404 | 500);
                return c.text(await response.text());
            }

            const arrayBuffer = await profileAsync(c, 'favicon_transform_body', () => response.arrayBuffer());

            await profileAsync(c, 'favicon_put', () => putObject(
                s3,
                env,
                faviconKey,
                new Uint8Array(arrayBuffer)
            ));

            return c.json({ url: `${accessHost}/${faviconKey}` });
        } catch (error) {
            if (error instanceof Error) {
                c.status(500);
                console.error("Error processing favicon:", error);
                return c.text(`Error processing favicon: ${error.message}`);
            }
        }
    });

    return app;
}
