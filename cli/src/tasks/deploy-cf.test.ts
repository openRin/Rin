import { describe, expect, it } from "bun:test";
import { collectWorkerSecrets } from "./deploy-cf";

describe("collectWorkerSecrets", () => {
  it("includes supported non-empty worker secrets", () => {
    const secrets = collectWorkerSecrets({
      JWT_SECRET: "jwt-secret",
      ADMIN_USERNAME: "admin",
      ADMIN_PASSWORD: "password",
      RIN_GITHUB_CLIENT_ID: "client-id",
      RIN_GITHUB_CLIENT_SECRET: "client-secret",
      S3_ACCESS_KEY_ID: "access-key",
      S3_SECRET_ACCESS_KEY: "secret-key",
      UNUSED: "ignored",
    });

    expect(secrets).toEqual({
      JWT_SECRET: "jwt-secret",
      ADMIN_USERNAME: "admin",
      ADMIN_PASSWORD: "password",
      RIN_GITHUB_CLIENT_ID: "client-id",
      RIN_GITHUB_CLIENT_SECRET: "client-secret",
      S3_ACCESS_KEY_ID: "access-key",
      S3_SECRET_ACCESS_KEY: "secret-key",
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
