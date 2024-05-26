import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import Elysia, { t } from "elysia";
import { setup } from "../setup";

const hasher = new Bun.CryptoHasher("md5");
const region = process.env.S3_REGION;
const endpoint = process.env.S3_ENDPOINT;
const accessKeyId = process.env.S3_ACCESS_KEY_ID;
const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
const accessHost = process.env.S3_ACCESS_HOST || endpoint;
const bucket = process.env.S3_BUCKET;
const folder = process.env.S3_FOLDER || '';
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

export const StorageService = new Elysia()
    .use(setup)
    .group('/storage', (group) =>
        group
            .post('/', async ({ uid, set, body: { key } }) => {
                // if (!uid) {
                //     set.status = 401;
                //     return 'Unauthorized';
                // }
                const suffix = key.split('.').pop();
                const random = Math.random().toString();
                hasher.update(random);
                hasher.update(key);
                const hashkey = folder + hasher.digest("hex") + "." + suffix;
                try {
                    const response = await getSignedUrl(s3, new PutObjectCommand({ Bucket: bucket, Key: hashkey }))
                    return {
                        upload_url: response,
                        url: `${accessHost}/${hashkey}`
                    }
                } catch (e: any) {
                    set.status = 400;
                    console.error(e.message)
                    return e.message
                }
            }, {
                body: t.Object({
                    key: t.String()
                })
            })
    );