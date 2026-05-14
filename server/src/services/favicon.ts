import { Hono } from "hono";
import type { AppContext } from "../core/hono-types";
import { profileAsync } from "../core/server-timing";
import { path_join } from "../utils/path";
import { getStorageObject, getStoragePublicUrl, putStorageObjectAtKey } from "../utils/storage";

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
    await putStorageObjectAtKey(
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
        const faviconKey = getFaviconKey(env);
        
        try {
            const response = await profileAsync(c, 'favicon_fetch', () => getStorageObject(env, faviconKey));

            if (!response) {
                const avatar = await profileAsync(c, 'favicon_avatar', () => clientConfig.get("site.avatar")) as string | undefined;
                if (!avatar) {
                    c.status(404);
                    return c.text("Favicon not found");
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
        
        try {
            for (const [mimeType, ext] of Object.entries(FAVICON_ALLOWED_TYPES)) {
                const originFaviconKey = path_join(env.S3_FOLDER || "", `originFavicon${ext}`);
                const response = await profileAsync(c, 'favicon_original_fetch', () => getStorageObject(env, originFaviconKey));

                if (response) {
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

            await profileAsync(c, 'favicon_origin_put', () => putStorageObjectAtKey(
                env,
                originFaviconKey,
                file
            ));

            const originFaviconUrl = getStoragePublicUrl(env, originFaviconKey, new URL(c.req.url).origin);
            const imageRequest = new Request(originFaviconUrl, {
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

            await profileAsync(c, 'favicon_put', () => putStorageObjectAtKey(
                env,
                faviconKey,
                new Uint8Array(arrayBuffer)
            ));

            return c.json({ url: getStoragePublicUrl(env, faviconKey, new URL(c.req.url).origin) });
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
