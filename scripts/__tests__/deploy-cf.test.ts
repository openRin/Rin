import { describe, expect, it } from "bun:test";
import { buildR2BucketInfo } from "../../cli/src/tasks/deploy-cf";

describe("deploy-cf R2 helpers", () => {
  it("builds derived S3 settings from R2 bucket name", () => {
    expect(buildR2BucketInfo("blog-images", "acct123")).toEqual({
      name: "blog-images",
      endpoint: "https://acct123.r2.cloudflarestorage.com",
      accessHost: "https://blog-images.acct123.r2.dev",
    });
  });
});
