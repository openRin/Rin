import { describe, expect, it } from "bun:test";
import { parseWranglerJson } from "../wrangler-json";

describe("parseWranglerJson", () => {
    it("parses plain JSON output", () => {
        expect(parseWranglerJson('[{"results":[{"name":"info"}],"success":true}]')).toEqual([
      { results: [{ name: "info" }], success: true },
        ]);
    });

    it("skips the proxy warning line wrangler prints before JSON", () => {
        // 设置了 HTTP_PROXY 时 wrangler 会输出这行提示
        const stdout = [
    "Proxy environment variables detected. We'll use your proxy for fetch requests.",
         "[",
      "  {",
    '    "results": [],',
        '    "success": true',
  "  }",
      "]",
        ].join("\n");

        expect(parseWranglerJson(stdout)).toEqual([{ results: [], success: true }]);
    });

    it("skips arbitrary leading noise", () => {
        const stdout = 'warning: something\n\n[{"success":true}]';

        expect(parseWranglerJson(stdout)).toEqual([{ success: true }]);
    });

    it("handles object output", () => {
        expect(parseWranglerJson('some noise\n{"key":"value"}')).toEqual({ key: "value" });
    });

    it("throws a helpful error when there is no JSON", () => {
        expect(() => parseWranglerJson("totally not json")).toThrow(/returned no JSON/);
    });
});