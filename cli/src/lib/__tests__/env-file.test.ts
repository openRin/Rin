import { describe, expect, it } from "bun:test";
import { maskEnvValue, unquoteEnvValue, upsertEnvLines } from "../env-file";

describe("upsertEnvLines", () => {
  it("updates existing keys in place and keeps comments", () => {
    const before = [
      "# 发布配置",
      "RIN_PUBLISH_API=https://old.example.com/api",
      "",
      "DB_NAME=rin",
    ].join("\n");

    const edit = upsertEnvLines(before, {
      RIN_PUBLISH_API: "https://new.example.com/api",
      DB_NAME: "rin",
    });

    expect(edit.updated).toEqual(["RIN_PUBLISH_API"]);
    expect(edit.appended).toEqual([]);
    expect(edit.content).toContain("# 发布配置");
    expect(edit.content).toContain("RIN_PUBLISH_API=https://new.example.com/api");
    expect(edit.content).toContain("DB_NAME=rin");
    // 未变化的键不应在 updated 里
    expect(edit.content).not.toContain("https://old.example.com");
  });

  it("appends missing keys at the end", () => {
    const edit = upsertEnvLines("# comment only\n", { ADMIN_USERNAME: "admin" });

    expect(edit.appended).toEqual(["ADMIN_USERNAME"]);
    expect(edit.content).toContain("# comment only");
    expect(edit.content).toContain("ADMIN_USERNAME=admin");
  });

  it("works on an empty file", () => {
    const edit = upsertEnvLines("", { ADMIN_PASSWORD: "p@ss" });

    expect(edit.appended).toEqual(["ADMIN_PASSWORD"]);
    expect(edit.content).toBe("ADMIN_PASSWORD=p@ss\n");
  });

  it("appends multiple keys in order after the last line", () => {
    const edit = upsertEnvLines("A=1\n\n", { B: "2", C: "3" });

    expect(edit.appended).toEqual(["B", "C"]);
    expect(edit.content.split("\n").filter(Boolean)).toEqual(["A=1", "B=2", "C=3"]);
  });

  it("keeps inline comments when updating a value", () => {
    const edit = upsertEnvLines("DB_NAME=rin # 本地库名", { DB_NAME: "cin" });

    expect(edit.content).toBe("DB_NAME=cin # 本地库名\n");
  });
});

describe("unquoteEnvValue / maskEnvValue", () => {
  it("strips paired quotes", () => {
    expect(unquoteEnvValue('"https://x/api"')).toBe("https://x/api");
    expect(unquoteEnvValue("'abc'")).toBe("abc");
    expect(unquoteEnvValue("plain")).toBe("plain");
    expect(unquoteEnvValue(undefined)).toBe("");
  });

  it("masks secrets but keeps a short prefix", () => {
    expect(maskEnvValue(undefined)).toBe("(not set)");
    expect(maskEnvValue("")).toBe("(not set)");
    expect(maskEnvValue("ab")).toBe("**");
    expect(maskEnvValue("secret-value")).toBe("se**********");
  });
});
