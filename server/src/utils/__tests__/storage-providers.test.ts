import { afterEach, describe, expect, it } from "bun:test";
import { detectStorageProviderKind, resolveStorageProvider } from "../storage/resolve";
import { SupabaseObjectStorage, createSupabaseObjectStorage } from "../storage/supabase";
import { S3ObjectStorage, createS3ObjectStorage } from "../storage/s3";
import { createR2ObjectStorage } from "../storage/r2";
import { createMockEnv, createMockSupabaseEnv } from "../../../tests/fixtures";

const originalFetch = globalThis.fetch;

/**
 * 构造测试用 env。
 * S3_* 被声明为 wrangler 生成的字面量类型，测试里覆盖需要放宽类型。
 */
function testEnv(overrides: Record<string, unknown> = {}): Env {
    return createMockEnv(overrides as Partial<Env>);
}

/** 记录请求并返回预设响应 */
function mockFetch(handler: (url: string, init: RequestInit) => Response) {
    const calls: Array<{ url: string; init: RequestInit }> = [];

    globalThis.fetch = (async (input: any, init: RequestInit = {}) => {
        const url = String(input);
        calls.push({ url, init });
        return handler(url, init);
    }) as typeof fetch;

    return calls;
}

afterEach(() => {
    globalThis.fetch = originalFetch;
});

describe("detectStorageProviderKind", () => {
    it("prefers explicit STORAGE_PROVIDER", () => {
        const env = testEnv({
            STORAGE_PROVIDER: "supabase",
            SUPABASE_URL: "https://x.supabase.co",
            SUPABASE_STORAGE_BUCKET: "b",
        });
        expect(detectStorageProviderKind(env)).toBe("supabase");
    });

    it("detects supabase from config when provider is unset", () => {
        const env = testEnv({
            SUPABASE_URL: "https://x.supabase.co",
            SUPABASE_STORAGE_BUCKET: "b",
        });
        expect(detectStorageProviderKind(env)).toBe("supabase");
    });

    it("falls back to s3 when nothing else is configured", () => {
        expect(detectStorageProviderKind(testEnv())).toBe("s3");
    });

    it("prefers r2 binding over s3 when provider is unset", () => {
        const env = testEnv({ R2_BUCKET: {} as R2Bucket });
        expect(detectStorageProviderKind(env)).toBe("r2");
    });

    it("rejects an unknown provider", () => {
        const env = testEnv({ STORAGE_PROVIDER: "gcs" });
        expect(() => detectStorageProviderKind(env)).toThrow(/is not supported/);
    });
});

describe("resolveStorageProvider", () => {
    it("returns an R2 provider when the binding exists", () => {
        const env = testEnv({ R2_BUCKET: {} as R2Bucket });
        expect(resolveStorageProvider(env).kind).toBe("r2");
    });

    it("returns an S3 provider by default", () => {
        expect(resolveStorageProvider(testEnv()).kind).toBe("s3");
    });

    it("returns a Supabase provider when configured", () => {
        expect(resolveStorageProvider(createMockSupabaseEnv()).kind).toBe("supabase");
    });

    it("throws a clear error when r2 is requested without a binding", () => {
        const env = testEnv({ STORAGE_PROVIDER: "r2" });
        expect(() => resolveStorageProvider(env)).toThrow(/R2_BUCKET binding is not configured/);
    });

    it("reports missing supabase config with the 'is not defined' contract", () => {
        const env = createMockSupabaseEnv({ SUPABASE_SECRET_KEY: "" });
        expect(() => resolveStorageProvider(env)).toThrow("SUPABASE_SECRET_KEY is not defined");
    });

    it("reports missing s3 config with the 'is not defined' contract", () => {
        const env = testEnv({ S3_ENDPOINT: "" });
        expect(() => resolveStorageProvider(env)).toThrow("S3_ENDPOINT is not defined");
    });
});

describe("R2ObjectStorage", () => {
    it("does not require any S3 credential", () => {
        const env = testEnv({
            R2_BUCKET: {} as R2Bucket,
            S3_ENDPOINT: "",
            S3_BUCKET: "",
            S3_ACCESS_KEY_ID: "",
            S3_SECRET_ACCESS_KEY: "",
        });
        expect(() => createR2ObjectStorage(env)).not.toThrow();
    });

    it("uses S3_ACCESS_HOST for the public URL", () => {
        const storage = resolveStorageProvider(
            testEnv({ R2_BUCKET: {} as R2Bucket, S3_ACCESS_HOST: "https://cdn.example.com" }),
        );
        expect(storage.publicUrl("images/a.png")).toBe("https://cdn.example.com/images/a.png");
    });

    it("falls back to the blob proxy when no access host is set", () => {
        const storage = resolveStorageProvider(
            testEnv({ R2_BUCKET: {} as R2Bucket, S3_ACCESS_HOST: "" }),
        );
        expect(storage.publicUrl("images/a b.png", "https://blog.example.com")).toBe(
            "https://blog.example.com/api/blob/images/a%20b.png",
        );
    });

    it("returns null when the object is missing", async () => {
        const env = testEnv({
            R2_BUCKET: {
                get: async () => null,
                head: async () => null,
                put: async () => ({}) as R2Object,
            } as unknown as R2Bucket,
        });
        const storage = resolveStorageProvider(env);

        expect(await storage.get("images/missing.png")).toBeNull();
        expect(await storage.head("images/missing.png")).toBeNull();
    });

    it("writes content type through httpMetadata", async () => {
        const calls: any[] = [];
        const env = testEnv({
            R2_BUCKET: {
                put: async (key: string, value: any, options?: R2PutOptions) => {
                    calls.push({ key, options });
                    return {} as R2Object;
                },
            } as unknown as R2Bucket,
        });

        await resolveStorageProvider(env).put("images/a.png", "body", "image/png");

        expect(calls[0].key).toBe("images/a.png");
        expect(calls[0].options.httpMetadata).toEqual({ contentType: "image/png" });
    });
});

describe("S3ObjectStorage", () => {
    it("builds virtual-hosted style URLs by default", () => {
        const storage = createS3ObjectStorage(
            testEnv({ S3_ENDPOINT: "https://s3.example.com", S3_BUCKET: "my-bucket" }),
        );
        expect((storage as S3ObjectStorage).objectUrl("images/a.png")).toBe(
            "https://my-bucket.s3.example.com/images/a.png",
        );
    });

    it("builds path-style URLs when forced", () => {
        const storage = createS3ObjectStorage(
            testEnv({
                S3_ENDPOINT: "https://s3.example.com",
                S3_BUCKET: "my-bucket",
                S3_FORCE_PATH_STYLE: "true",
            }),
        );
        expect((storage as S3ObjectStorage).objectUrl("images/a.png")).toBe(
            "https://s3.example.com/my-bucket/images/a.png",
        );
    });

    it("prefers S3_ACCESS_HOST over the endpoint for public URLs", () => {
        const storage = createS3ObjectStorage(
            testEnv({ S3_ACCESS_HOST: "https://cdn.example.com/" }),
        );
        expect(storage.publicUrl("images/a.png")).toBe("https://cdn.example.com/images/a.png");
    });
});

describe("SupabaseObjectStorage", () => {
    it("targets the Storage REST object endpoint", async () => {
        const calls = mockFetch(() => new Response("body", { status: 200 }));
        const storage = createSupabaseObjectStorage(createMockSupabaseEnv());

        await storage.get("images/a.png");

        expect(calls[0].url).toBe(
            "https://test-project.supabase.co/storage/v1/object/test-bucket/images/a.png",
        );
    });

    it("sends only the apikey header for secret keys", async () => {
        const calls = mockFetch(() => new Response("body", { status: 200 }));
        const storage = createSupabaseObjectStorage(createMockSupabaseEnv());

        await storage.get("images/a.png");

        const headers = calls[0].init.headers as Headers;
        expect(headers.get("apikey")).toBe("sb_secret_test-key");
        // sb_secret_ 不是 JWT，放进 Authorization: Bearer 会被判为非法凭据
        expect(headers.get("Authorization")).toBe(null);
    });

    it("sends both headers for legacy service_role JWTs", async () => {
        const calls = mockFetch(() => new Response("body", { status: 200 }));
        const legacyJwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.sig";
        const storage = createSupabaseObjectStorage(
            createMockSupabaseEnv({ SUPABASE_SECRET_KEY: legacyJwt }),
        );

        await storage.get("images/a.png");

        const headers = calls[0].init.headers as Headers;
        expect(headers.get("apikey")).toBe(legacyJwt);
        expect(headers.get("Authorization")).toBe(`Bearer ${legacyJwt}`);
    });

    it("falls back to the legacy variable name when the new one is unset", async () => {
        const calls = mockFetch(() => new Response("body", { status: 200 }));
        const storage = createSupabaseObjectStorage(
            createMockSupabaseEnv({
                SUPABASE_SECRET_KEY: "",
                SUPABASE_SERVICE_ROLE_KEY: "sb_secret_from_old_name",
            }),
        );

        await storage.get("images/a.png");

        const headers = calls[0].init.headers as Headers;
        expect(headers.get("apikey")).toBe("sb_secret_from_old_name");
    });

    it("encodes each key segment to prevent path traversal", async () => {
        const calls = mockFetch(() => new Response("body", { status: 200 }));
        const storage = createSupabaseObjectStorage(createMockSupabaseEnv());

        await storage.get("images/a b/../c.png");

        // 纯点段必须被丢弃：new URL() 会把 %2E%2E 还原成 .. 再规范化，逃出 bucket
        expect(calls[0].url).toBe(
            "https://test-project.supabase.co/storage/v1/object/test-bucket/images/a%20b/c.png",
        );
    });

    it("keeps '..' segments inside the bucket path", async () => {
        const calls = mockFetch(() => new Response("body", { status: 200 }));
        const storage = createSupabaseObjectStorage(createMockSupabaseEnv());

        await storage.get("a/../../../secret.txt");

        expect(new URL(calls[0].url).pathname).toBe(
            "/storage/v1/object/test-bucket/a/secret.txt",
        );
    });

    it("uploads with x-upsert and the given content type", async () => {
        const calls = mockFetch(() => new Response("{}", { status: 200 }));
        const storage = createSupabaseObjectStorage(createMockSupabaseEnv());

        await storage.put("images/a.png", "data", "image/png");

        const headers = calls[0].init.headers as Headers;
        expect(calls[0].init.method).toBe("POST");
        expect(headers.get("x-upsert")).toBe("true");
        expect(headers.get("Content-Type")).toBe("image/png");
        expect(calls[0].init.body).toBe("data");
    });

    it("treats 404 as a missing object", async () => {
        mockFetch(() => new Response("not found", { status: 404 }));
        const storage = createSupabaseObjectStorage(createMockSupabaseEnv());

        expect(await storage.get("images/missing.png")).toBeNull();
        expect(await storage.head("images/missing.png")).toBeNull();
    });

    it("treats a 400 NoSuchKey body as a missing object", async () => {
        mockFetch(
            () =>
                new Response(JSON.stringify({ errorCode: "NoSuchKey" }), {
                    status: 400,
                    headers: { "Content-Type": "application/json" },
                }),
        );
        const storage = createSupabaseObjectStorage(createMockSupabaseEnv());

        expect(await storage.get("images/missing.png")).toBeNull();
    });

    it("treats the REST endpoint's 400 body as a missing object", async () => {
        // Supabase REST 端点实际返回 { statusCode: "404", error: "not_found", code: "NoSuchKey" }
        // 字段名是 code 而非 errorCode，漏判会让「文件不存在」变成 500。
        mockFetch(
            () =>
                new Response(
                    JSON.stringify({
                        statusCode: "404",
                        error: "not_found",
                        message: "Object not found",
                        code: "NoSuchKey",
                    }),
                    { status: 400, headers: { "Content-Type": "application/json" } },
                ),
        );
        const storage = createSupabaseObjectStorage(createMockSupabaseEnv());

        expect(await storage.get("favicon.ico")).toBeNull();
        expect(await storage.head("favicon.ico")).toBeNull();
    });

    it("still throws for a genuine 400 error", async () => {
        mockFetch(
            () =>
                new Response(JSON.stringify({ code: "InvalidRequest", message: "bad bucket" }), {
                    status: 400,
                    headers: { "Content-Type": "application/json" },
                }),
        );
        const storage = createSupabaseObjectStorage(createMockSupabaseEnv());

        expect(storage.get("images/a.png")).rejects.toThrow(/Failed to fetch storage object: 400/);
    });

    it("throws on non-404 error responses", async () => {
        mockFetch(() => new Response("boom", { status: 500 }));
        const storage = createSupabaseObjectStorage(createMockSupabaseEnv());

        expect(storage.get("images/a.png")).rejects.toThrow(/Failed to fetch storage object: 500/);
    });

    it("throws when the upload fails", async () => {
        mockFetch(() => new Response("denied", { status: 403 }));
        const storage = createSupabaseObjectStorage(createMockSupabaseEnv());

        expect(storage.put("images/a.png", "data")).rejects.toThrow(
            /Failed to upload to Supabase Storage: 403/,
        );
    });

    it("uses the blob proxy for private buckets", () => {
        const storage = createSupabaseObjectStorage(createMockSupabaseEnv());
        expect(storage.publicUrl("images/a.png", "https://blog.example.com")).toBe(
            "https://blog.example.com/api/blob/images/a.png",
        );
    });

    it("uses the direct public URL when the bucket is public", () => {
        const storage = createSupabaseObjectStorage(
            createMockSupabaseEnv({ SUPABASE_STORAGE_PUBLIC: "true" }),
        );
        expect(storage.publicUrl("images/a.png", "https://blog.example.com")).toBe(
            "https://test-project.supabase.co/storage/v1/object/public/test-bucket/images/a.png",
        );
    });

    it("signs URLs for private buckets", async () => {
        const calls = mockFetch(() =>
            new Response(JSON.stringify({ signedURL: "/object/sign/test-bucket/images/a.png?token=x" }), {
                status: 200,
            }),
        );
        const storage = createSupabaseObjectStorage(createMockSupabaseEnv());

        const url = await storage.signedUrl("images/a.png", 600);

        expect(calls[0].url).toBe(
            "https://test-project.supabase.co/storage/v1/object/sign/test-bucket/images/a.png",
        );
        expect(calls[0].init.method).toBe("POST");
        expect(calls[0].init.body).toBe(JSON.stringify({ expiresIn: 600 }));
        expect(url).toBe(
            "https://test-project.supabase.co/storage/v1/object/sign/test-bucket/images/a.png?token=x",
        );
    });

    it("returns the plain public URL for public buckets without signing", async () => {
        const calls = mockFetch(() => new Response("{}", { status: 200 }));
        const storage = createSupabaseObjectStorage(
            createMockSupabaseEnv({ SUPABASE_STORAGE_PUBLIC: "true" }),
        );

        const url = await storage.signedUrl("images/a.png", 600);

        expect(calls.length).toBe(0);
        expect(url).toBe(
            "https://test-project.supabase.co/storage/v1/object/public/test-bucket/images/a.png",
        );
    });

    it("rejects a sign response without signedURL", async () => {
        mockFetch(() => new Response(JSON.stringify({}), { status: 200 }));
        const storage = new SupabaseObjectStorage(
            "https://x.supabase.co",
            "b",
            "key",
            false,
        );

        expect(storage.signedUrl("a.png", 60)).rejects.toThrow(/missing signedURL/);
    });
});