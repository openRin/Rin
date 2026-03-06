import { describe, expect, it } from "bun:test";
import { matchesExpectedUpdatedAt, normalizeQueueUpdatedAt } from "../feed-ai-summary";

describe("feed-ai-summary queue timestamps", () => {
  it("matches second-based queue timestamps", () => {
    const updatedAt = new Date("2026-03-06T12:34:56.789Z");

    expect(
      matchesExpectedUpdatedAt(updatedAt, {
        expectedUpdatedAtUnix: normalizeQueueUpdatedAt(updatedAt),
      }),
    ).toBe(true);
  });

  it("matches legacy ISO timestamps after second normalization", () => {
    const updatedAt = new Date("2026-03-06T12:34:56.789Z");

    expect(
      matchesExpectedUpdatedAt(updatedAt, {
        expectedUpdatedAt: "2026-03-06T12:34:56.000Z",
      }),
    ).toBe(true);
  });

  it("rejects stale timestamps", () => {
    const updatedAt = new Date("2026-03-06T12:34:56.789Z");

    expect(
      matchesExpectedUpdatedAt(updatedAt, {
        expectedUpdatedAtUnix: normalizeQueueUpdatedAt(new Date("2026-03-06T12:34:55.000Z")),
      }),
    ).toBe(false);
  });
});
