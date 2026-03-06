import { Hono } from "hono";
import type { AppContext } from "../core/hono-types";
import { path_join } from "../utils/path";
import { createS3Client, putObject } from "../utils/s3";

function buf2hex(buffer: ArrayBuffer) {
    return [...new Uint8Array(buffer)]
        .map(x => x.toString(16).padStart(2, '0'))
        .join('');
}

export function StorageService(): Hono {
    const app = new Hono();

    // POST /storage
    app.post('/', async (c: AppContext) => {
        const uid = c.get('uid');
        const env = c.get('env');
        
        const body = await c.req.parseBody();
        const key = body.key as string;
        const file = body.file as File;
        
        const endpoint = env.S3_ENDPOINT;
        const bucket = env.S3_BUCKET;
        const folder = env.S3_FOLDER || '';
        const accessHost = env.S3_ACCESS_HOST || endpoint;
        const accessKeyId = env.S3_ACCESS_KEY_ID;
        const secretAccessKey = env.S3_SECRET_ACCESS_KEY;
        const s3 = createS3Client(env);

        if (!endpoint) {
            return c.text('S3_ENDPOINT is not defined', 500);
        }
        if (!accessKeyId) {
            return c.text('S3_ACCESS_KEY_ID is not defined', 500);
        }
        if (!secretAccessKey) {
            return c.text('S3_SECRET_ACCESS_KEY is not defined', 500);
        }
        if (!bucket) {
            return c.text('S3_BUCKET is not defined', 500);
        }
        if (!uid) {
            return c.text('Unauthorized', 401);
        }
        
        const suffix = key.includes(".") ? key.split('.').pop() : "";
        const hashArray = await crypto.subtle.digest(
            { name: 'SHA-1' },
            await file.arrayBuffer()
        );
        const hash = buf2hex(hashArray);
        const hashkey = path_join(folder, hash + "." + suffix);
        
        try {
            await putObject(
                s3,
                env,
                hashkey,
                file,
                file.type
            );
            return c.json({ url: `${accessHost}/${hashkey}` });
        } catch (e: any) {
            console.error(e.message);
            return c.text(e.message, 400);
        }
    });

    return app;
}
