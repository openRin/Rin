import { AwsClient } from "aws4fetch";
import {
    buildBlobUrl,
    encodeObjectKey,
    missingConfig,
    trimTrailingSlash,
    type ObjectStorage,
    type StorageBody,
} from "./types";

/** 任意 S3 兼容后端（R2 S3 API、AWS S3、MinIO 等）。用 aws4fetch 做 SigV4 签名 */
export class S3ObjectStorage implements ObjectStorage {
    readonly kind = "s3" as const;

    private client: AwsClient;

    constructor(
        private endpoint: string,
        private bucket: string,
        accessKeyId: string,
        secretAccessKey: string,
        private forcePathStyle: boolean,
        private accessHost?: string,
    ) {
        this.client = new AwsClient({
            accessKeyId,
            secretAccessKey,
            service: "s3",
        });
    }

    /** 构造对象 URL，兼容 path-style 与 virtual-hosted style。用 URL 对象避免路径被 `//` 折叠 */
    objectUrl(storageKey: string): string {
        const base = new URL(this.endpoint);
        const encodedKey = encodeObjectKey(storageKey);

        if (!this.forcePathStyle) {
            return new URL(
                `/${encodedKey}`,
                `${base.protocol}//${this.bucket}.${base.host}/`,
            ).toString();
        }

        const basePath = base.pathname.replace(/\/?$/, "/");
        return new URL(`${this.bucket}/${encodedKey}`, `${base.origin}${basePath}`).toString();
    }

    async get(storageKey: string): Promise<Response | null> {
        const response = await this.client.fetch(this.objectUrl(storageKey), {
            method: "GET",
        });

        if (response.status === 404) {
            return null;
        }

        if (!response.ok) {
            throw new Error(`Failed to fetch storage object: ${response.status} ${response.statusText}`);
        }

        return response;
    }

    async head(storageKey: string): Promise<Response | null> {
        const response = await this.client.fetch(this.objectUrl(storageKey), {
            method: "HEAD",
        });

        if (response.status === 404) {
            return null;
        }

        if (!response.ok) {
            throw new Error(`Failed to inspect storage object: ${response.status} ${response.statusText}`);
        }

        return response;
    }

    async put(storageKey: string, body: StorageBody, contentType?: string): Promise<void> {
        const headers: Record<string, string> = {};
        if (contentType) {
            headers["Content-Type"] = contentType;
        }

        const response = await this.client.fetch(this.objectUrl(storageKey), {
            method: "PUT",
            body: body as BodyInit,
            headers,
        });

        if (!response.ok) {
            throw new Error(`Failed to upload to S3: ${response.status} ${response.statusText}`);
        }
    }

    publicUrl(storageKey: string, baseUrl?: string): string {
        if (this.accessHost) {
            return `${trimTrailingSlash(this.accessHost)}/${storageKey}`;
        }
        return buildBlobUrl(storageKey, baseUrl);
    }
}

export function createS3ObjectStorage(env: Env): S3ObjectStorage {
    if (!env.S3_ENDPOINT) {
        missingConfig("S3_ENDPOINT");
    }
    if (!env.S3_ACCESS_KEY_ID) {
        missingConfig("S3_ACCESS_KEY_ID");
    }
    if (!env.S3_SECRET_ACCESS_KEY) {
        missingConfig("S3_SECRET_ACCESS_KEY");
    }
    if (!env.S3_BUCKET) {
        missingConfig("S3_BUCKET");
    }

    return new S3ObjectStorage(
        env.S3_ENDPOINT,
        env.S3_BUCKET,
        env.S3_ACCESS_KEY_ID,
        env.S3_SECRET_ACCESS_KEY,
        env.S3_FORCE_PATH_STYLE === "true",
        env.S3_ACCESS_HOST,
    );
}