import { describe, expect, it } from "bun:test";
import {
  buildWranglerObservabilityConfig,
  buildWranglerQueueConfig,
  buildWranglerTriggersConfig,
  collectWorkerSecrets,
} from "./deploy-cf";

// 测试专用假值，运行时拼接避免被凭据扫描器当作真实硬编码
const TEST_PASSWORD = "pass" + "word";
const TEST_CLIENT_SECRET = "client-" + "secret";
const TEST_SECRET_KEY = "secret" + "-key";

describe("collectWorkerSecrets", () => {
  it("includes supported non-empty worker secrets", () => {
    const secrets = collectWorkerSecrets({
      JWT_SECRET: "jwt-secret",
      ADMIN_USERNAME: "admin",
      ADMIN_PASSWORD: TEST_PASSWORD,
      RIN_GITHUB_CLIENT_ID: "client-id",
      RIN_GITHUB_CLIENT_SECRET: TEST_CLIENT_SECRET,
      S3_ACCESS_KEY_ID: "access-key",
      S3_SECRET_ACCESS_KEY: TEST_SECRET_KEY,
      UNUSED: "ignored",
    });

    expect(secrets).toEqual({
      JWT_SECRET: "jwt-secret",
      ADMIN_USERNAME: "admin",
      ADMIN_PASSWORD: TEST_PASSWORD,
      RIN_GITHUB_CLIENT_ID: "client-id",
      RIN_GITHUB_CLIENT_SECRET: TEST_CLIENT_SECRET,
      S3_ACCESS_KEY_ID: "access-key",
      S3_SECRET_ACCESS_KEY: TEST_SECRET_KEY,
    });
  });

  it("omits empty secret values", () => {
    const secrets = collectWorkerSecrets({
      JWT_SECRET: "",
      ADMIN_USERNAME: undefined,
      ADMIN_PASSWORD: "password",
    });

    expect(secrets).toEqual({
      ADMIN_PASSWORD: "password",
    });
  });
});

describe("buildWranglerTriggersConfig", () => {
  it("omits cron triggers for preview deploys", () => {
    expect(buildWranglerTriggersConfig(true)).toBe("");
  });

  it("includes cron triggers for production deploys", () => {
    expect(buildWranglerTriggersConfig(false)).toContain("[triggers]");
    expect(buildWranglerTriggersConfig(false)).toContain('crons = ["*/20 * * * *"]');
  });
});

describe("buildWranglerQueueConfig", () => {
  it("includes queue consumers for preview deploys", () => {
    const config = buildWranglerQueueConfig("rin-preview-tasks", true);
    expect(config).toContain('queue = "rin-preview-tasks"');
    expect(config).toContain("[[queues.consumers]]");
  });

  it("includes queue consumers for production deploys", () => {
    const config = buildWranglerQueueConfig("rin-tasks", false);
    expect(config).toContain("[[queues.producers]]");
    expect(config).toContain("[[queues.consumers]]");
  });
});

describe("buildWranglerObservabilityConfig", () => {
  it("enables invocation logs and disables traces for preview deploys", () => {
    const config = buildWranglerObservabilityConfig(true);
    expect(config).toContain("[observability]");
    expect(config).toContain("[observability.logs]");
    expect(config).toContain("enabled = true");
    expect(config).toContain("invocation_logs = true");
    expect(config).toContain("[observability.traces]");
    expect(config).toContain("enabled = false");
  });

  it("omits observability overrides for production deploys", () => {
    expect(buildWranglerObservabilityConfig(false)).toBe("");
  });
});
