import {
    buildBlobUrl,
    trimTrailingSlash,
    type ObjectStorage,
    type StorageBody,
} from "./types";

/**
 * Cloudflare R2 binding 后端。
 *
 * 走 Workers 原生 binding，不产生外部网络请求，也不消耗签名凭证。
 */
export class R2ObjectStorage implements ObjectStorage {
    readonly kind = "r2" as const;

    constructor(private bucket: R2Bucket, private accessHost?: string) {}

    async get(storageKey: string): Promise<Response | null> {
        const object = await this.bucket.get(storageKey);
        if (!object) {
            return null;
        }
        return createR2Response(object, object.body);
    }

    async head(storageKey: string): Promise<Response | null> {
        const object = await this.bucket.head(storageKey);
        if (!object) {
            return null;
        }
        return createR2Response(object);
    }

    async put(storageKey: string, body: StorageBody, contentType?: string): Promise<void> {
        await this.bucket.put(storageKey, body, {
            httpMetadata: contentType ? { contentType } : undefined,
        });
    }

    publicUrl(storageKey: string, baseUrl?: string): string {
        if (this.accessHost) {
            return `${trimTrailingSlash(this.accessHost)}/${storageKey}`;
        }
        return buildBlobUrl(storageKey, baseUrl);
    }
}

/**
 * R2 对象没有标准 HTTP 响应，需要补齐 ETag / 长度 / 缓存头。
 * R2 的 `writeHttpMetadata` 只写 content-type 等少数字段。
 */
function createR2Response(object: R2ObjectBody | R2Object, body?: BodyInit | null) {
    const headers = new Headers();
    object.writeHttpMetadata(headers);

    if (object.httpEtag) {
        headers.set("ETag", object.httpEtag);
    }

    if (!headers.has("Content-Length")) {
        headers.set("Content-Length", String(object.size));
    }

    if (!headers.has("Last-Modified")) {
        headers.set("Last-Modified", object.uploaded.toUTCString());
    }

    if (!headers.has("Cache-Control")) {
        headers.set("Cache-Control", "public, max-age=31536000, immutable");
    }

    if (!headers.has("Access-Control-Allow-Origin")) {
        headers.set("Access-Control-Allow-Origin", "*");
    }

    return new Response(body ?? null, {
        status: 200,
        headers,
    });
}

/**
 * R2 binding 自带 bucket 上下文，不需要任何 S3 凭证或 bucket 名。
 * 没有 binding 时返回 null，交由调用方回退到其他后端。
 */
export function createR2ObjectStorage(env: Env): R2ObjectStorage | null {
    if (!env.R2_BUCKET) {
        return null;
    }
    return new R2ObjectStorage(env.R2_BUCKET, env.S3_ACCESS_HOST);
}