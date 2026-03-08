import { describe, expect, it } from "bun:test";
import { inlineClientConfigHtml } from "../html-config";

describe("inlineClientConfigHtml", () => {
  it("injects client config before the closing head tag", () => {
    const html = "<html><head><title>Rin</title></head><body></body></html>";
    const result = inlineClientConfigHtml(html, {
      "site.name": "Rin",
      "theme.color": "#fc466b",
    });

    expect(result).toContain('<script id="rin-client-config">');
    expect(result).toContain('window.__RIN_CLIENT_CONFIG__={"site.name":"Rin","theme.color":"#fc466b"};');
    expect(result.indexOf("</script></head>")).toBeGreaterThan(-1);
  });

  it("escapes script-breaking characters in serialized config", () => {
    const html = "<html><body></body></html>";
    const result = inlineClientConfigHtml(html, {
      "site.name": "</script><script>alert(1)</script>",
    });

    expect(result).toContain("\\u003C/script\\u003E\\u003Cscript\\u003Ealert(1)\\u003C/script\\u003E");
    expect(result).not.toContain("</script><script>alert(1)</script>");
  });
});
