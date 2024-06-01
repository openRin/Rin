import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import Elysia, { t } from "elysia";
import type { DB } from "../_worker";
import type { Env } from "../db/db";
import { setup } from "../setup";



export const StorageService = (db: DB, env: Env) => {
    const region = env.S3_REGION;
    const endpoint = env.S3_ENDPOINT;
    const accessKeyId = env.S3_ACCESS_KEY_ID;
    const secretAccessKey = env.S3_SECRET_ACCESS_KEY;
    const accessHost = env.S3_ACCESS_HOST || endpoint;
    const bucket = env.S3_BUCKET;
    const folder = env.S3_FOLDER || '';
    if (!endpoint) {
        throw new Error('S3_ENDPOINT is not defined');
    }
    if (!accessKeyId) {
        throw new Error('S3_ACCESS_KEY_ID is not defined');
    }
    if (!secretAccessKey) {
        throw new Error('S3_SECRET_ACCESS_KEY is not defined');
    }
    if (!bucket) {
        throw new Error('S3_BUCKET is not defined');
    }
    const s3 = new S3Client({
        region: region,
        endpoint: endpoint,
        credentials: {
            accessKeyId: accessKeyId,
            secretAccessKey: secretAccessKey
        }
    });
    return new Elysia({ aot: false })
        .use(setup(db, env))
        .group('/storage', (group) =>
            group
                .post('/', async ({ uid, set, body: { key, file } }) => {
                    if (!uid) {
                        set.status = 401;
                        return 'Unauthorized';
                    }
                    const suffix = key.includes(".") ? key.split('.').pop() : "";
                    var uuid = crypto.randomUUID();
                    const hashkey = folder + uuid + "." + suffix;
                    try {
                        const response = await s3.send(new PutObjectCommand({ Bucket: bucket, Key: hashkey, Body: file }))
                        console.info(response);
                        return `${accessHost}/${hashkey}`
                    } catch (e: any) {
                        set.status = 400;
                        console.error(e.message)
                        return e.message
                    }
                }, {
                    body: t.Object({
                        key: t.String(),
                        file: t.File()
                    })
                })
        );
}