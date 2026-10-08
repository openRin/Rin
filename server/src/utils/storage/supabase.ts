import {
    buildBlobUrl,
    encodeObjectKey,
    missingConfig,
    type ObjectStorage,
    type StorageBody,
} from "./types";

/**
 * Supabase Storage 后端。走 REST API（而非 S3 兼容端点），
 * 只需 Project URL + service_role key，不依赖 Supabase 侧的 S3 凭证。
 * 端点：/storage/v1/object/{bucket}/{path}，公开桶直链加 /public/，签名用 /object/sign/。
 */
export class SupabaseObjectStorage implements ObjectStorage {
    readonly kind = "supabase" as const;

    private baseUrl: string;

    constructor(
        projectUrl: string,
        private bucket: string,
        private apiKey: string,
        /** bucket 是否为 public。公开桶才敢直链，否则一律走 Worker 反代 */
        private isPublicBucket: boolean,
    ) {
        this.baseUrl = `${trimUrl(projectUrl)}/storage/v1`;
    }

    /**
     * 鉴权头。legacy service_role JWT（eyJ 开头）需带
     * `Authorization: Bearer`；新版 secret/publishable key 不是 JWT，
     * 放进 Bearer 会被判非法，只带 `apikey` 头。
     */
    private authHeaders(): Headers {
        const headers = new Headers();
        headers.set("apikey", this.apiKey);

        if (this.isLegacyJwtKey()) {
            headers.set("Authorization", `Bearer ${this.apiKey}`);
        }

        return headers;
    }

    /** legacy service_role 是 JWT（以 eyJ 开头），新版 key 都是短字符串 */
    private isLegacyJwtKey(): boolean {
        return this.apiKey.startsWith("eyJ");
    }

    private objectUrl(storageKey: string): string {
        return `${this.baseUrl}/object/${encodeBucketPath(this.bucket, storageKey)}`;
    }

    async get(storageKey: string): Promise<Response | null> {
        const response = await fetch(this.objectUrl(storageKey), {
            method: "GET",
            headers: this.authHeaders(),
        });

        if (await isNotFound(response)) {
            return null;
        }

        if (!response.ok) {
            throw new Error(
                `Failed to fetch storage object: ${response.status} ${await readErrorText(response)}`,
            );
        }

        return response;
    }

    async head(storageKey: string): Promise<Response | null> {
        const response = await fetch(this.objectUrl(storageKey), {
            method: "HEAD",
            headers: this.authHeaders(),
        });

        if (await isNotFound(response)) {
            return null;
        }

        if (!response.ok) {
            throw new Error(
                `Failed to inspect storage object: ${response.status} ${await readErrorText(response)}`,
            );
        }

        return response;
    }

    async put(storageKey: string, body: StorageBody, contentType?: string): Promise<void> {
        const headers = this.authHeaders();
        // Rin 的对象键是内容哈希，天然幂等，重复写入直接覆盖。
        headers.set("x-upsert", "true");

        if (contentType) {
            headers.set("Content-Type", contentType);
        }

        const response = await fetch(this.objectUrl(storageKey), {
            method: "POST",
            headers,
            body: body as BodyInit,
        });

        if (!response.ok) {
            throw new Error(
                `Failed to upload to Supabase Storage: ${response.status} ${await readErrorText(response)}`,
            );
        }
    }

    publicUrl(storageKey: string, baseUrl?: string): string {
        if (this.isPublicBucket) {
            return `${this.baseUrl}/object/public/${encodeBucketPath(this.bucket, storageKey)}`;
        }
        return buildBlobUrl(storageKey, baseUrl);
    }

    /** 生成限时签名 URL。公开桶无需签名；私有 bucket 需要它才能把直链交给浏览器 */
    async signedUrl(storageKey: string, expiresIn: number): Promise<string> {
        if (this.isPublicBucket) {
            return this.publicUrl(storageKey);
        }

        const headers = this.authHeaders();
        headers.set("Content-Type", "application/json");

        const response = await fetch(
            `${this.baseUrl}/object/sign/${encodeBucketPath(this.bucket, storageKey)}`,
            {
                method: "POST",
                headers,
                body: JSON.stringify({ expiresIn }),
            },
        );

        if (!response.ok) {
            throw new Error(
                `Failed to sign storage URL: ${response.status} ${await readErrorText(response)}`,
            );
        }

        const payload = (await response.json()) as { signedURL?: string };
        if (!payload?.signedURL) {
            throw new Error("Supabase Storage sign response missing signedURL");
        }

        return `${this.baseUrl}${payload.signedURL}`;
    }
}

function trimUrl(value: string) {
    return value.endsWith("/") ? value.slice(0, -1) : value;
}

/** 编码 bucket 与对象路径。bucket 名不编码；对象路径按段编码防路径穿越 */
function encodeBucketPath(bucket: string, storageKey: string) {
    const encodedKey = encodeObjectKey(storageKey);
    return encodedKey ? `${bucket}/${encodedKey}` : bucket;
}

/**
 * Supabase 对缺失对象：REST 端点返回 400（body 带 NoSuchKey/not_found），
 * 部分路径返回 404。统一归一成「不存在」，避免把文件未上传当服务端故障抛错。
 */
async function isNotFound(response: Response) {
    if (response.status === 404) {
        return true;
    }

    if (response.status !== 400) {
        return false;
    }

    // HEAD 响应通常没有 body 可读，只能保守地当作「存在」处理。
    const contentType = response.headers.get("Content-Type") || "";
    if (!contentType.includes("json")) {
        return false;
    }

    try {
        const body = (await response.clone().json()) as any;
        // REST 端点用 code，个别路径用 errorCode / error_code，三者都认。
        const code = body?.code || body?.errorCode || body?.error_code;
        const status = body?.statusCode;
        return (
            code === "NoSuchKey" ||
            code === "not_found" ||
            body?.error === "not_found" ||
            status === "404" ||
            status === 404
        );
    } catch {
        return false;
    }
}

async function readErrorText(response: Response) {
    try {
        return (await response.clone().text()).slice(0, 200);
    } catch {
        return response.statusText;
    }
}

export function createSupabaseObjectStorage(env: Env): SupabaseObjectStorage {
    if (!env.SUPABASE_URL) {
        missingConfig("SUPABASE_URL");
    }

    const apiKey = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
    if (!apiKey) {
        missingConfig("SUPABASE_SECRET_KEY");
    }

    if (!env.SUPABASE_STORAGE_BUCKET) {
        missingConfig("SUPABASE_STORAGE_BUCKET");
    }

    return new SupabaseObjectStorage(
        env.SUPABASE_URL,
        env.SUPABASE_STORAGE_BUCKET,
        apiKey,
        env.SUPABASE_STORAGE_PUBLIC === "true",
    );
}