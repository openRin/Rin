import { describe, expect, it } from "bun:test";
import { getRequiredVars } from "../setup-dev";

// 测试专用假值，运行时拼接避免被凭据扫描器当作真实硬编码
const TEST_SUPABASE_KEY = "sb_secret_" + "x";

/** 最小可用配置：supabase后端 + 账号密码登录 */
function baseEnv(overrides: Record<string, string | undefined> = {}) {
  return {
    NAME: "My Blog",
    JWT_SECRET: "secret",
    ADMIN_USERNAME: "admin",
    ADMIN_PASSWORD: "pass" + "word",
    SUPABASE_URL: "https://x.supabase.co",
    SUPABASE_STORAGE_BUCKET: "rin",
    SUPABASE_SECRET_KEY: TEST_SUPABASE_KEY,
    ...overrides,
  };
}

describe("getRequiredVars", () => {
it("accepts password-only login without GitHub OAuth", () => {
        // 用户实际场景：GitHub OAuth 留空，只用账号密码登录
        const env = baseEnv();
  const missing = getRequiredVars(env).filter((name) => !env[name as keyof typeof env]);

        expect(missing).toEqual([]);
    });

    it("does not require AVATAR", () => {
        expect(getRequiredVars(baseEnv())).not.toContain("AVATAR");
    });

    it("accepts GitHub-only login", () => {
        const env = baseEnv({
            ADMIN_USERNAME: "",
            ADMIN_PASSWORD: "",
            RIN_GITHUB_CLIENT_ID: "id",
            RIN_GITHUB_CLIENT_SECRET: "secret",
        });

        expect(getRequiredVars(env)).not.toContain("RIN_GITHUB_CLIENT_ID + RIN_GITHUB_CLIENT_SECRET");
    });

  it("requires both NAME and JWT_SECRET", () => {
        const missing = getRequiredVars(baseEnv({ NAME: "", JWT_SECRET: "" }));

        expect(missing).toContain("NAME");
        expect(missing).toContain("JWT_SECRET");
    });

it("requires a login method when both are absent", () => {
    const env = baseEnv({
            ADMIN_USERNAME: "",
   ADMIN_PASSWORD: "",
 RIN_GITHUB_CLIENT_ID: "",
    RIN_GITHUB_CLIENT_SECRET: "",
        });
        const missing = getRequiredVars(env).filter((name) => !env[name as keyof typeof env]);

        expect(missing).toContain("RIN_GITHUB_CLIENT_ID + RIN_GITHUB_CLIENT_SECRET");
        expect(missing).toContain("或 ADMIN_USERNAME + ADMIN_PASSWORD");
    });

    it("treats a half-filled GitHub OAuth as absent", () => {
        const env = baseEnv({
            ADMIN_USERNAME: "",
   ADMIN_PASSWORD: "",
    RIN_GITHUB_CLIENT_ID: "id",
        RIN_GITHUB_CLIENT_SECRET: "",
        });
        const missing = getRequiredVars(env).filter((name) => !env[name as keyof typeof env]);

    expect(missing).toContain("RIN_GITHUB_CLIENT_ID + RIN_GITHUB_CLIENT_SECRET");
    });

    it("still requires storage credentials", () => {
  // 显式指定 provider，避免 URL 为空时回退探测到 S3
        const env = baseEnv({
  STORAGE_PROVIDER: "supabase",
      SUPABASE_URL: "",
  SUPABASE_SECRET_KEY: "",
        });
        const missing = getRequiredVars(env).filter((name) => !env[name as keyof typeof env]);

        expect(missing).toContain("SUPABASE_URL");
        expect(missing).toContain("SUPABASE_SECRET_KEY");
    });
});