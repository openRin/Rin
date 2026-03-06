import { afterEach, describe, expect, it, mock } from "bun:test";

const originalFetch = globalThis.fetch;

const getAIConfigMock = mock();

mock.module("../db-config", () => ({
  getAIConfig: getAIConfigMock,
}));

afterEach(() => {
  globalThis.fetch = originalFetch;
  getAIConfigMock.mockReset();
});

describe("generateAISummaryResult", () => {
  it("returns a concrete error when AI responds with empty content", async () => {
    getAIConfigMock.mockResolvedValue({
      enabled: true,
      provider: "worker-ai",
      model: "llama-3-8b",
      api_key: "",
      api_url: "",
    });

    const { generateAISummaryResult } = await import("../ai");

    const result = await generateAISummaryResult({
      AI: {
        run: async () => ({ response: "" }),
      },
    } as unknown as Env, {} as any, "test content");

    expect(result.summary).toBeNull();
    expect(result.skipped).toBe(false);
    expect(result.error).toContain('Empty response from AI provider "worker-ai"');
  });

  it("sends summary system prompt to Workers AI", async () => {
    getAIConfigMock.mockResolvedValue({
      enabled: true,
      provider: "worker-ai",
      model: "llama-3-8b",
      api_key: "",
      api_url: "",
    });

    const calls: Array<any> = [];
    const { AI_SUMMARY_SYSTEM_PROMPT, generateAISummaryResult } = await import("../ai");

    const result = await generateAISummaryResult({
      AI: {
        run: async (_model: string, payload: any) => {
          calls.push(payload);
          return { response: "summary" };
        },
      },
    } as unknown as Env, {} as any, "test content");

    expect(result.summary).toBe("summary");
    expect(calls).toHaveLength(1);
    expect(calls[0].messages[0]).toEqual({
      role: "system",
      content: AI_SUMMARY_SYSTEM_PROMPT,
    });
    expect(calls[0].messages[1]).toEqual({
      role: "user",
      content: "test content",
    });
  });

  it("sends summary system prompt to external AI providers", async () => {
    getAIConfigMock.mockResolvedValue({
      enabled: true,
      provider: "openai",
      model: "gpt-4o-mini",
      api_key: "secret",
      api_url: "https://api.openai.com/v1",
    });

    const requests: Array<any> = [];
    globalThis.fetch = mock(async (_url: string | URL | Request, init?: RequestInit) => {
      requests.push(init);
      return new Response(JSON.stringify({
        choices: [{ message: { content: "summary" } }],
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    const { AI_SUMMARY_SYSTEM_PROMPT, generateAISummaryResult } = await import("../ai");

    const result = await generateAISummaryResult({} as Env, {} as any, "external content");

    expect(result.summary).toBe("summary");
    expect(requests).toHaveLength(1);
    const body = JSON.parse(String(requests[0].body));
    expect(body.messages[0]).toEqual({
      role: "system",
      content: AI_SUMMARY_SYSTEM_PROMPT,
    });
    expect(body.messages[1]).toEqual({
      role: "user",
      content: "external content",
    });
  });
});
