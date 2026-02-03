import { PutObjectCommand } from "@aws-sdk/client-s3";
import { t } from "elysia";
import base from "../base";
import { path_join } from "../utils/path";
import { createS3Client } from "../utils/s3";


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

export const FaviconService = () => base()
    .get("/favicon", async ({ set, store: { env } }) => {
        const s3 = createS3Client(env);
        const bucket = env.S3_BUCKET;
        const accessHost = env.S3_ACCESS_HOST || env.S3_ENDPOINT;
        const faviconKey = getFaviconKey(env);
        
        try {
            const response = await fetch(
                new Request(`${accessHost}/${faviconKey}`),
            );

            if (!response.ok) {
                set.status = response.status;
                return await response.text();
            }

            set.headers["Content-Type"] = "image/webp";
            set.headers["Cache-Control"] = "public, max-age=31536000"; // 1 year

            return await response.arrayBuffer();
        } catch (error) {
            if (error instanceof Error) {
                set.status = 500;
                console.error("Error fetching favicon:", error);
                return `Error fetching favicon: ${error.message}`;
            }
        }
    })
    .get("/favicon/original", async ({ set, store: { env } }) => {
        const accessHost = env.S3_ACCESS_HOST || env.S3_ENDPOINT;
        
        try {
            let originFaviconKey = null;
            for (const [mimeType, ext] of Object.entries(
                FAVICON_ALLOWED_TYPES,
            )) {
                originFaviconKey = path_join(
                    env.S3_FOLDER || "",
                    `originFavicon${ext}`,
                );
                const response = await fetch(
                    new Request(`${accessHost}/${originFaviconKey}`),
                );

                if (response.ok) {
                    set.headers["Content-Type"] = mimeType;
                    set.headers["Cache-Control"] =
                        "public, max-age=31536000"; // 1 year

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
    })
    .post(
        "/favicon",
        async ({ request, set, body: { file }, admin, store: { env } }) => {
            const s3 = createS3Client(env);
            const bucket = env.S3_BUCKET;
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
                    return new Response("Disallowed file type", {
                        status: 400,
                    });
                }
                const originFaviconKey = path_join(
                    env.S3_FOLDER || "",
                    `originFavicon${FAVICON_ALLOWED_TYPES[file.type]}`,
                );

                await s3.send(
                    new PutObjectCommand({
                        Bucket: bucket,
                        Key: originFaviconKey,
                        Body: file,
                    }),
                );

                const imageRequest = new Request(
                    `${accessHost}/${originFaviconKey}`,
                    {
                        headers: request.headers,
                    },
                );

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
                const buffer = Buffer.from(arrayBuffer);

                await s3.send(
                    new PutObjectCommand({
                        Bucket: bucket,
                        Key: faviconKey,
                        Body: buffer,
                    }),
                );

                return {
                    url: `${accessHost}/${faviconKey}`,
                };
            } catch (error) {
                if (error instanceof Error) {
                    set.status = 500;
                    console.error("Error processing favicon:", error);
                    return `Error processing favicon: ${error.message}`;
                }
            }
        },
        {
            body: t.Object({
                file: t.File(),
            }),
        },
    )