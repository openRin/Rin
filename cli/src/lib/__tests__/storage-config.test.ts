import { describe, expect, it } from "bun:test";
import { buildStorageVarsToml, resolveStorageConfig } from "../storage-config";

describe("resolveStorageConfig", () => {
    it("defaults to s3 and requires S3 credentials", () => {
        const config = resolveStorageConfig({ S3_ENDPOINT: "https://s3.example.com" });

        expect(config.provider).toBe("s3");
        expect(config.missing).toEqual(["S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"]);
    });

    it("selects r2 when R2_BUCKET_NAME is set and needs no credentials", () => {
        const config = resolveStorageConfig({ R2_BUCKET_NAME: "my-bucket" });

        expect(config.provider).toBe("r2");
        expect(config.missing).toEqual([]);
        expect(config.vars.S3_BUCKET).toBe("");
    });

    it("detects supabase from SUPABASE_URL and bucket", () => {
        const config = resolveStorageConfig({
            SUPABASE_URL: "https://x.supabase.co",
            SUPABASE_STORAGE_BUCKET: "rin",
            SUPABASE_SECRET_KEY: "key",
        });

        expect(config.provider).toBe("supabase");
        expect(config.missing).toEqual([]);
        expect(config.vars.SUPABASE_URL).toBe("https://x.supabase.co");
        expect(config.vars.SUPABASE_STORAGE_BUCKET).toBe("rin");
        expect(config.vars.STORAGE_PROVIDER).toBe("supabase");
    });

    it("keeps the service role key out of vars and puts it in secrets", () => {
        const config = resolveStorageConfig({
            SUPABASE_URL: "https://x.supabase.co",
            SUPABASE_STORAGE_BUCKET: "rin",
            SUPABASE_SECRET_KEY: "super-" + "secret",
        });

        expect(config.vars.SUPABASE_SECRET_KEY).toBeUndefined();
        expect(config.secrets.SUPABASE_SECRET_KEY).toBe("super-secret");
    });

    it("defaults SUPABASE_STORAGE_PUBLIC to false", () => {
        const config = resolveStorageConfig({
            SUPABASE_URL: "https://x.supabase.co",
            SUPABASE_STORAGE_BUCKET: "rin",
            SUPABASE_SECRET_KEY: "key",
        });

        expect(config.vars.SUPABASE_STORAGE_PUBLIC).toBe("false");
    });

    it("accepts the legacy SUPABASE_SERVICE_ROLE_KEY name", () => {
        const config = resolveStorageConfig({
            SUPABASE_URL: "https://x.supabase.co",
            SUPABASE_STORAGE_BUCKET: "rin",
            SUPABASE_SERVICE_ROLE_KEY: "sb_secret_from_old_name",
        });

        expect(config.missing).toEqual([]);
        expect(config.secrets.SUPABASE_SECRET_KEY).toBe("sb_secret_from_old_name");
        expect(config.secrets.SUPABASE_SERVICE_ROLE_KEY).toBeUndefined();
    });

    it("reports every missing supabase variable", () => {
        const config = resolveStorageConfig({ STORAGE_PROVIDER: "supabase" });

        expect(config.provider).toBe("supabase");
        expect(config.missing).toEqual([
            "SUPABASE_URL",
            "SUPABASE_SECRET_KEY",
            "SUPABASE_STORAGE_BUCKET",
        ]);
    });

    it("lets an explicit provider override auto-detection", () => {
        const config = resolveStorageConfig({
            STORAGE_PROVIDER: "s3",
            SUPABASE_URL: "https://x.supabase.co",
            SUPABASE_STORAGE_BUCKET: "rin",
            SUPABASE_SECRET_KEY: "key",
        });

        expect(config.provider).toBe("s3");
    });

    it("rejects an unsupported provider", () => {
        expect(() => resolveStorageConfig({ STORAGE_PROVIDER: "gcs" })).toThrow(/is not supported/);
    });

    it("always emits the S3 folder prefixes", () => {
        const config = resolveStorageConfig({
            SUPABASE_URL: "https://x.supabase.co",
            SUPABASE_STORAGE_BUCKET: "rin",
            SUPABASE_SECRET_KEY: "key",
        });

        expect(config.vars.S3_FOLDER).toBe("images/");
        expect(config.vars.S3_CACHE_FOLDER).toBe("cache/");
    });
});

describe("buildStorageVarsToml", () => {
    it("renders one KEY = value line per entry", () => {
        const toml = buildStorageVarsToml({ S3_FOLDER: "images/", STORAGE_PROVIDER: "s3" });

        expect(toml).toBe('S3_FOLDER = "images/"\nSTORAGE_PROVIDER = "s3"');
    });

it("applies the given indent to every line", () => {
  const toml = buildStorageVarsToml({ A: "1", B: "2" }, "  ");

  expect(toml).toBe('  A = "1"\n  B = "2"');
});

it("emits zero-indent lines so the block can be appended outside stripIndent", () => {
  // deploy-cf 把 [vars] 段整体移出 stripIndent 模板单独追加，
  // 因此这里必须输出零缩进；否则 stripIndent 会因插值行缩进为 0
  // 而判定最小缩进为 0，导致 main 等字段带着缩进、wrangler 读不到 entry-point。
  const toml = buildStorageVarsToml({ A: "1", B: "2" });

  expect(toml).toBe('A = "1"\nB = "2"');
  expect(toml.split("\n").every((line) => !line.startsWith(" "))).toBe(true);
});
});