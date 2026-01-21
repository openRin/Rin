import Elysia, { t } from "elysia";
import {
    PutObjectCommand,
    GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getEnv } from "../utils/di";
import { setup } from "../setup";
import { createS3Client } from "../utils/s3";
import path from "path";

export const FAVICON_ALLOWED_TYPES: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/gif": ".gif",
    "image/webp": ".webp",
};

export function getFaviconKey() {
    const env = getEnv();
    return path.join(env.S3_FOLDER || "", "favicon.webp");
}

export function FaviconService() {
    const env = getEnv();
    const s3 = createS3Client();
    const bucket = env.S3_BUCKET;
    const faviconKey = getFaviconKey();

    return new Elysia({ aot: false })
        .use(setup())

        .get("/favicon", async ({ set }) => {
            try {
                const res = await s3.send(
                    new GetObjectCommand({
                        Bucket: bucket,
                        Key: faviconKey,
                    })
                );

                set.headers["Content-Type"] = "image/webp";
                set.headers["Cache-Control"] =
                    "public, max-age=31536000, immutable";

                return await res.Body!.transformToByteArray();
            } catch {
                set.status = 404;
                return "Favicon not found";
            }
        })

        .get("/favicon/original", async ({ set }) => {
            for (const [mimeType, ext] of Object.entries(
                FAVICON_ALLOWED_TYPES
            )) {
                const key = path.join(
                    env.S3_FOLDER || "",
                    `originFavicon${ext}`
                );

                try {
                    const res = await s3.send(
                        new GetObjectCommand({
                            Bucket: bucket,
                            Key: key,
                        })
                    );

                    set.headers["Content-Type"] = mimeType;
                    set.headers["Cache-Control"] =
                        "public, max-age=31536000";

                    return await res.Body!.transformToByteArray();
                } catch {
                    // 不存在就继续试下一个格式
                }
            }

            set.status = 404;
            return "Original favicon not found";
        })

        .post(
            "/favicon",
            async ({ set, body: { file }, admin }) => {
                if (!admin) {
                    set.status = 403;
                    return "Permission denied";
                }

                const MAX_FILE_SIZE = 10 * 1024 * 1024;
                if (file.size > MAX_FILE_SIZE) {
                    set.status = 400;
                    return "File too large";
                }

                const ext = FAVICON_ALLOWED_TYPES[file.type];
                if (!ext) {
                    set.status = 400;
                    return "Disallowed file type";
                }

                const originKey = path.join(
                    env.S3_FOLDER || "",
                    `originFavicon${ext}`
                );

                await s3.send(
                    new PutObjectCommand({
                        Bucket: bucket,
                        Key: originKey,
                        Body: file,
                        ContentType: file.type,
                    })
                );


                const signedUrl = await getSignedUrl(
                    s3,
                    new GetObjectCommand({
                        Bucket: bucket,
                        Key: originKey,
                    }),
                    { expiresIn: 60 }
                );

                const response = await fetch(signedUrl, {
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
                    set.status = 500;
                    return "Image resize failed";
                }

                const buffer = Buffer.from(
                    await response.arrayBuffer()
                );

                await s3.send(
                    new PutObjectCommand({
                        Bucket: bucket,
                        Key: faviconKey,
                        Body: buffer,
                        ContentType: "image/webp",
                    })
                );

                return {
                    ok: true,
                    key: faviconKey,
                };
            },
            {
                body: t.Object({
                    file: t.File(),
                }),
            }
        );
}
