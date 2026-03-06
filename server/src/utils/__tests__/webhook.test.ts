import { describe, expect, it } from "bun:test";
import { buildWebhookRequest } from "../webhook";

describe("buildWebhookRequest", () => {
  it("uses the default JSON webhook body", () => {
    const request = buildWebhookRequest(
      {
        event: "comment.created",
        message: "hello",
      },
      {
        urlTemplate: "https://example.com/webhook",
      },
    );

    expect(request.headers["Content-Type"]).toBe("application/json");
    expect(request.url).toBe("https://example.com/webhook");
    expect(request.body).toBe("{\"content\":\"hello\"}");
  });

  it("renders custom webhook templates with payload variables", () => {
    const request = buildWebhookRequest(
      {
        event: "friend.created",
        message: "message",
        title: "My Friend",
        url: "https://example.com/friends",
        username: "alice",
        content: "https://friend.example.com",
        description: "desc",
      },
      {
        urlTemplate: "https://example.com/hook?event={{event}}&user={{username}}",
        method: "put",
        contentType: "text/plain",
        headers: "{\"X-Event\":\"{{event}}\",\"Authorization\":\"Bearer {{username}}\"}",
        bodyTemplate: "event={{event}}\nuser={{username}}\ntitle={{title}}\nurl={{url}}\ncontent={{content}}\ndescription={{description}}",
      },
    );

    expect(request.url).toBe("https://example.com/hook?event=friend.created&user=alice");
    expect(request.method).toBe("PUT");
    expect(request.headers["Content-Type"]).toBe("text/plain");
    expect(request.headers["X-Event"]).toBe("friend.created");
    expect(request.headers.Authorization).toBe("Bearer alice");
    expect(request.body).toContain("event=friend.created");
    expect(request.body).toContain("user=alice");
    expect(request.body).toContain("title=My Friend");
    expect(request.body).toContain("url=https://example.com/friends");
    expect(request.body).toContain("content=https://friend.example.com");
    expect(request.body).toContain("description=desc");
  });

  it("does not attach a body for GET webhooks", () => {
    const request = buildWebhookRequest(
      {
        event: "webhook.test",
        message: "hello",
      },
      {
        urlTemplate: "https://example.com/hook?message={{message}}",
        method: "get",
        contentType: "application/json",
        bodyTemplate: "{\"message\":\"{{message}}\"}",
      },
    );

    expect(request.method).toBe("GET");
    expect(request.url).toBe("https://example.com/hook?message=hello");
    expect(request.body).toBeUndefined();
    expect(request.headers["Content-Type"]).toBeUndefined();
  });
});
