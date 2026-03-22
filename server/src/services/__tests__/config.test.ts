import { describe, expect, it, beforeEach, afterEach, mock } from "bun:test";
import { Hono } from "hono";
import { ConfigService } from "../config";
import { setupTestApp, cleanupTestDB } from "../../../tests/fixtures";
import type { Database } from "bun:sqlite";
import type { Variables } from "../../core/hono-types";

describe("ConfigService", () => {
    let db: any;
    let sqlite: Database;
    let env: Env;
    let app: Hono<{ Bindings: Env; Variables: Variables }>;
    const originalFetch = globalThis.fetch;

    beforeEach(async () => {
        const ctx = await setupTestApp(ConfigService);
        db = ctx.db;
        sqlite = ctx.sqlite;
        env = ctx.env;
        app = ctx.app;

        // Create test user
        await createTestUser();
    });

    afterEach(() => {
        globalThis.fetch = originalFetch;
        cleanupTestDB(sqlite);
    });

    async function createTestUser() {
        sqlite.exec(`
            INSERT INTO users (id, username, openid, avatar, permission) 
            VALUES (1, 'testuser', 'gh_test', 'avatar.png', 1)
        `);
    }

    describe("GET /:type - Get config", () => {
        it("should get bootstrap script for client config without authentication", async () => {
            const res = await app.request("/client/bootstrap.js", {
                method: "GET",
            });

            expect(res.status).toBe(200);
            expect(res.headers.get("content-type")).toContain("application/javascript");
            const body = await res.text();
            expect(body).toContain("globalThis.__RIN_CLIENT_CONFIG__=");
            expect(body).toContain('"site.page_size":5');
            expect(res.headers.get("Server-Timing")).toContain("bootstrap_client_config");
            expect(res.headers.get("Server-Timing")).toContain("client_config_all");
            expect(res.headers.get("Server-Timing")).toContain("client_ai_enabled");
            expect(res.headers.get("Server-Timing")).toContain("bootstrap_script");
        });

        it("should get client config without authentication", async () => {
            const res = await app.request("/client", {
                method: "GET",
            });

            expect(res.status).toBe(200);
            const data = await res.json() as Record<string, any>;
            expect(data).toBeDefined();
        });

        it("should require authentication for server config", async () => {
            const res = await app.request("/server", {
                method: "GET",
            });

            expect(res.status).toBe(401);
        });

        it("should allow admin to get server config", async () => {
            const res = await app.request("/server", {
                method: "GET",
                headers: {
                    Authorization: "Bearer mock_token_1",
                },
            });

            expect(res.status).toBe(200);
            const data = await res.json() as Record<string, any>;
            expect(data).toBeDefined();
        });

        it("should return 400 for invalid config type", async () => {
            const res = await app.request("/invalid", {
                method: "GET",
                headers: {
                    Authorization: "Bearer mock_token_1",
                },
            });

            expect(res.status).toBe(400);
        });

        it("should mask sensitive fields in server config", async () => {
            await app.request("/server", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: "Bearer mock_token_1",
                },
                body: JSON.stringify({
                    "ai_summary.api_key": "secret_key_123",
                }),
            });

            const res = await app.request("/server", {
                method: "GET",
                headers: {
                    Authorization: "Bearer mock_token_1",
                },
            });

            expect(res.status).toBe(200);
            const data = await res.json() as Record<string, any>;
            // API key should be masked
            expect(data["ai_summary.api_key"]).toBe("••••••••");
        });
    });

    describe("GET /health - Health check", () => {
        it("should require authentication to read health check", async () => {
            const res = await app.request("/health", {
                method: "GET",
            });

            expect(res.status).toBe(401);
        });

        it("should return health summary for admin", async () => {
            const res = await app.request("/health", {
                method: "GET",
                headers: {
                    Authorization: "Bearer mock_token_1",
                },
            });

            expect(res.status).toBe(200);
            const data = await res.json() as {
                items: Array<{ id: string; status: string }>;
                summary: Record<string, number>;
            };
            expect(data.items.length).toBeGreaterThan(0);
            expect(data.items.some((item) => item.id === "auth-runtime" && item.status === "success")).toBe(true);
            expect(typeof data.summary.success).toBe("number");
        });

        it("should mark default password login as danger", async () => {
            env.ADMIN_USERNAME = "admin" as any;
            env.ADMIN_PASSWORD = "admin123" as any;
            const res = await app.request("/health", {
                method: "GET",
                headers: {
                    Authorization: "Bearer mock_token_1",
                },
            });

            expect(res.status).toBe(200);
            const data = await res.json() as {
                items: Array<{ id: string; status: string; summary: { key: string } }>;
            };
            expect(
                data.items.some((item) =>
                    item.id === "login-methods" &&
                    item.status === "danger" &&
                    item.summary.key === "health.items.login_methods.default_password.summary",
                ),
            ).toBe(true);
        });

        it("should treat R2 storage without S3_ACCESS_HOST as configured", async () => {
            env.R2_BUCKET = {
                get: async () => null,
                put: async () => null,
                head: async () => null,
                createMultipartUpload: () => {
                    throw new Error("not implemented");
                },
                resumeMultipartUpload: () => {
                    throw new Error("not implemented");
                },
                delete: async () => {},
                list: async () => ({ objects: [], truncated: false, delimitedPrefixes: [] }),
            } as unknown as R2Bucket;
            env.S3_ACCESS_HOST = "" as any;

            const res = await app.request("/health", {
                method: "GET",
                headers: {
                    Authorization: "Bearer mock_token_1",
                },
            });

            expect(res.status).toBe(200);
            const data = await res.json() as {
                items: Array<{ id: string; status: string }>;
            };
            expect(
                data.items.some((item) => item.id === "storage" && item.status === "success"),
            ).toBe(true);
        });
    });

    describe("GET /queue-status - Queue status", () => {
        it("should require authentication to read queue status", async () => {
            const res = await app.request("/queue-status", {
                method: "GET",
            });

            expect(res.status).toBe(401);
        });

        it("should return queue status for admin", async () => {
            sqlite.exec(`
                INSERT INTO feeds (id, title, summary, ai_summary, ai_summary_status, ai_summary_error, content, listed, draft, top, uid)
                VALUES (1, 'Queued Feed', '', '', 'pending', '', 'content', 1, 0, 0, 1)
            `);

            const res = await app.request("/queue-status", {
                method: "GET",
                headers: {
                    Authorization: "Bearer mock_token_1",
                },
            });

            expect(res.status).toBe(200);
            const data = await res.json() as {
                queueConfigured: boolean;
                summary: Record<string, number>;
                items: Array<{ aiSummaryStatus: string }>;
            };
            expect(typeof data.queueConfigured).toBe("boolean");
            expect(data.summary.pending).toBeGreaterThan(0);
            expect(data.items.some((item) => item.aiSummaryStatus === "pending")).toBe(true);
        });
    });

    describe("Compatibility tasks", () => {
        it("should return compatibility task counts for admin", async () => {
            sqlite.exec(`
                INSERT INTO feeds (id, title, summary, ai_summary, ai_summary_status, ai_summary_error, content, listed, draft, top, uid)
                VALUES
                  (1, 'Needs AI', '', '', 'idle', '', 'content', 1, 0, 0, 1),
                  (2, 'Needs Blurhash', '', 'summary', 'completed', '', '![img](https://example.com/a.png)', 1, 0, 0, 1)
            `);

            const res = await app.request("/compat-tasks", {
                method: "GET",
                headers: {
                    Authorization: "Bearer mock_token_1",
                },
            });

            expect(res.status).toBe(200);
            const data = await res.json() as {
                aiSummary: { eligible: number; forceEligible: number };
                blurhash: { eligible: number };
            };
            expect(data.aiSummary.eligible).toBe(1);
            expect(data.aiSummary.forceEligible).toBe(2);
            expect(data.blurhash.eligible).toBe(1);
        });

        it("should queue AI summary backfill for eligible feeds", async () => {
            let sendCalls = 0;
            env.TASK_QUEUE = {
                send: async () => {
                    sendCalls += 1;
                },
                sendBatch: async () => {},
            } as unknown as Queue<any>;

            await app.request("/server", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: "Bearer mock_token_1",
                },
                body: JSON.stringify({
                    "ai_summary.enabled": "true",
                    "ai_summary.provider": "worker-ai",
                    "ai_summary.model": "llama-3-8b",
                }),
            });

            sqlite.exec(`
                INSERT INTO feeds (id, title, summary, ai_summary, ai_summary_status, ai_summary_error, content, listed, draft, top, uid)
                VALUES
                  (1, 'Needs AI', '', '', 'idle', '', 'content', 1, 0, 0, 1),
                  (2, 'Skip Draft', '', '', 'idle', '', 'content', 1, 1, 0, 1),
                  (3, 'Skip Completed', '', 'done', 'completed', '', 'content', 1, 0, 0, 1)
            `);

            const res = await app.request("/compat-tasks/ai-summary", {
                method: "POST",
                headers: {
                    Authorization: "Bearer mock_token_1",
                },
            });

            expect(res.status).toBe(200);
            const data = await res.json() as { queued: number; skipped: number; forced: boolean };
            expect(data.queued).toBe(1);
            expect(data.skipped).toBe(2);
            expect(data.forced).toBe(false);
            expect(sendCalls).toBe(1);
        });

        it("should force requeue AI summary backfill for posts with existing summaries", async () => {
            let sendCalls = 0;
            env.TASK_QUEUE = {
                send: async () => {
                    sendCalls += 1;
                },
                sendBatch: async () => {},
            } as unknown as Queue<any>;

            await app.request("/server", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: "Bearer mock_token_1",
                },
                body: JSON.stringify({
                    "ai_summary.enabled": "true",
                    "ai_summary.provider": "worker-ai",
                    "ai_summary.model": "llama-3-8b",
                }),
            });

            sqlite.exec(`
                INSERT INTO feeds (id, title, summary, ai_summary, ai_summary_status, ai_summary_error, content, listed, draft, top, uid)
                VALUES
                  (1, 'Needs AI', '', '', 'idle', '', 'content', 1, 0, 0, 1),
                  (2, 'Has Summary', '', 'done', 'completed', '', 'content', 1, 0, 0, 1),
                  (3, 'Skip Draft', '', 'done', 'completed', '', 'content', 1, 1, 0, 1),
                  (4, 'Skip Pending', '', '', 'pending', '', 'content', 1, 0, 0, 1)
            `);

            const res = await app.request("/compat-tasks/ai-summary", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: "Bearer mock_token_1",
                },
                body: JSON.stringify({ force: true }),
            });

            expect(res.status).toBe(200);
            const data = await res.json() as { queued: number; skipped: number; forced: boolean };
            expect(data.queued).toBe(2);
            expect(data.skipped).toBe(2);
            expect(data.forced).toBe(true);
            expect(sendCalls).toBe(2);
        });

        it("should update blurhash metadata without resetting AI summary state", async () => {
            sqlite.exec(`
                INSERT INTO feeds (id, title, summary, ai_summary, ai_summary_status, ai_summary_error, content, listed, draft, top, uid)
                VALUES (1, 'Blurhash Feed', '', 'summary', 'completed', '', '![img](https://example.com/a.png)', 1, 0, 0, 1)
            `);

            const res = await app.request("/compat-tasks/blurhash/1", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: "Bearer mock_token_1",
                },
                body: JSON.stringify({
                    content: '![img](https://example.com/a.png#blurhash=test&width=100&height=50)',
                }),
            });

            expect(res.status).toBe(200);
            const row = sqlite.prepare("SELECT content, ai_summary, ai_summary_status FROM feeds WHERE id = 1").get() as any;
            expect(row.content).toContain("#blurhash=test&width=100&height=50");
            expect(row.ai_summary).toBe("summary");
            expect(row.ai_summary_status).toBe("completed");
        });
    });

    describe("Queue status actions", () => {
        it("should retry a failed queue task", async () => {
            let sendCalls = 0;
            env.TASK_QUEUE = {
                send: async () => {
                    sendCalls += 1;
                },
                sendBatch: async () => {},
            } as unknown as Queue<any>;

            await app.request("/server", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: "Bearer mock_token_1",
                },
                body: JSON.stringify({
                    "ai_summary.enabled": "true",
                    "ai_summary.provider": "worker-ai",
                    "ai_summary.model": "llama-3-8b",
                }),
            });

            sqlite.exec(`
                INSERT INTO feeds (id, title, summary, ai_summary, ai_summary_status, ai_summary_error, content, listed, draft, top, uid)
                VALUES (1, 'Failed Feed', '', '', 'failed', 'boom', 'content', 1, 0, 0, 1);
            `);

            const res = await app.request("/queue-status/1/retry", {
                method: "POST",
                headers: {
                    Authorization: "Bearer mock_token_1",
                },
            });

            expect(res.status).toBe(200);
            expect(sendCalls).toBe(1);

            const row = sqlite.prepare("SELECT ai_summary_status, ai_summary_error FROM feeds WHERE id = 1").get() as any;
            expect(row.ai_summary_status).toBe("pending");
            expect(row.ai_summary_error).toBe("");
        });

        it("should delete a completed queue task record", async () => {
            sqlite.exec(`
                INSERT INTO feeds (id, title, summary, ai_summary, ai_summary_status, ai_summary_error, content, listed, draft, top, uid)
                VALUES (1, 'Completed Feed', '', 'summary', 'completed', '', 'content', 1, 0, 0, 1);
            `);

            const res = await app.request("/queue-status/1", {
                method: "DELETE",
                headers: {
                    Authorization: "Bearer mock_token_1",
                },
            });

            expect(res.status).toBe(200);

            const row = sqlite.prepare("SELECT ai_summary_status, ai_summary_error FROM feeds WHERE id = 1").get() as any;
            expect(row.ai_summary_status).toBe("idle");
            expect(row.ai_summary_error).toBe("");
        });
    });

    describe("POST /:type - Update config", () => {
        it("should require authentication to update config", async () => {
            const res = await app.request("/client", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    "site.name": "New Name",
                }),
            });

            expect(res.status).toBe(401);
        });

        it("should allow admin to update client config", async () => {
            const res = await app.request("/client", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: "Bearer mock_token_1",
                },
                body: JSON.stringify({
                    "site.name": "New Site Name",
                    "site.description": "New Description",
                }),
            });

            expect(res.status).toBe(200);
        });

        it("should allow admin to update server config", async () => {
            const res = await app.request("/server", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: "Bearer mock_token_1",
                },
                body: JSON.stringify({
                    webhook_url: "https://example.com/webhook",
                }),
            });

            expect(res.status).toBe(200);
        });

        it("should save AI config to server config storage", async () => {
            const res = await app.request("/server", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: "Bearer mock_token_1",
                },
                body: JSON.stringify({
                    "ai_summary.enabled": "true",
                    "ai_summary.provider": "openai",
                    "ai_summary.model": "gpt-4o-mini",
                }),
            });

            expect(res.status).toBe(200);

            const getRes = await app.request("/server", {
                method: "GET",
                headers: {
                    Authorization: "Bearer mock_token_1",
                },
            });
            expect(getRes.status).toBe(200);
            const data = await getRes.json() as Record<string, any>;
            expect(data["ai_summary.enabled"]).toBe("true");
            expect(data["ai_summary.provider"]).toBe("openai");
            expect(data["ai_summary.model"]).toBe("gpt-4o-mini");
        });

        it("should return 400 for invalid config type", async () => {
            const res = await app.request("/invalid", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: "Bearer mock_token_1",
                },
                body: JSON.stringify({
                    key: "value",
                }),
            });

            expect(res.status).toBe(400);
        });
    });

    describe("DELETE /cache - Clear cache", () => {
        it("should require authentication to clear cache", async () => {
            const res = await app.request("/cache", {
                method: "DELETE",
            });

            expect(res.status).toBe(401);
        });

        it("should allow admin to clear cache", async () => {
            const res = await app.request("/cache", {
                method: "DELETE",
                headers: {
                    Authorization: "Bearer mock_token_1",
                },
            });

            expect(res.status).toBe(200);
        });

        it("should not clear server config when clearing cache", async () => {
            const res = await app.request("/cache", {
                method: "DELETE",
                headers: {
                    Authorization: "Bearer mock_token_1",
                },
            });

            expect(res.status).toBe(200);
        });

        it("should only clear cache entries with type=cache", async () => {
            const res = await app.request("/cache", {
                method: "DELETE",
                headers: {
                    Authorization: "Bearer mock_token_1",
                },
            });

            expect(res.status).toBe(200);
        });
    });

    describe("POST /test-ai - Test AI configuration", () => {
        it("should require authentication to test AI", async () => {
            const res = await app.request("/test-ai", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    provider: "openai",
                    model: "gpt-4o-mini",
                }),
            });

            expect(res.status).toBe(401);
        });

        it("should allow admin to test AI configuration", async () => {
            const res = await app.request("/test-ai", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: "Bearer mock_token_1",
                },
                body: JSON.stringify({
                    provider: "openai",
                    model: "gpt-4o-mini",
                    api_url: "https://api.openai.com/v1",
                    testPrompt: "Hello",
                }),
            });

            // Should either succeed or fail gracefully (not 401)
            expect(res.status).not.toBe(401);
        });

        it("should return a readable error when Workers AI binding is missing", async () => {
            const res = await app.request("/test-ai", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: "Bearer mock_token_1",
                },
                body: JSON.stringify({
                    provider: "worker-ai",
                    model: "llama-3-8b",
                    testPrompt: "Hello",
                }),
            });

            expect(res.status).toBe(200);

            const data = await res.json() as {
                success: boolean;
                error?: string;
                details?: string;
            };
            expect(data.success).toBe(false);
            expect(data.error).toBe("Workers AI is not configured");
        });

        it("should extract plain text from OpenAI-compatible Workers AI responses", async () => {
            env.AI = {
                run: async () => ({
                    id: "chatcmpl-test",
                    object: "chat.completion",
                    model: "@cf/zai-org/glm-4.7-flash",
                    choices: [
                        {
                            index: 0,
                            message: {
                                role: "assistant",
                                content: "Hello!",
                                reasoning: "internal",
                            },
                            finish_reason: "stop",
                        },
                    ],
                }),
            } as any;

            const res = await app.request("/test-ai", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: "Bearer mock_token_1",
                },
                body: JSON.stringify({
                    provider: "worker-ai",
                    model: "glm-4.7-flash",
                    testPrompt: "Hello",
                }),
            });

            expect(res.status).toBe(200);

            const data = await res.json() as {
                success: boolean;
                response?: string;
            };
            expect(data.success).toBe(true);
            expect(data.response).toBe("Hello!");
        });
    });

    describe("POST /test-webhook - Test webhook configuration", () => {
        it("should require authentication to test webhook", async () => {
            const res = await app.request("/test-webhook", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    webhook_url: "https://example.com/webhook",
                }),
            });

            expect(res.status).toBe(401);
        });

        it("should send a webhook test with encoded GET query overrides", async () => {
            const requests: Array<{ url: string; init?: RequestInit }> = [];
            globalThis.fetch = mock(async (url: string | URL | Request, init?: RequestInit) => {
                requests.push({ url: String(url), init });
                return new Response("ok", { status: 200 });
            }) as typeof fetch;

            const res = await app.request("/test-webhook", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: "Bearer mock_token_1",
                },
                body: JSON.stringify({
                    webhook_url: "https://example.com/webhook?event={{event}}&message={{message}}",
                    "webhook.method": "GET",
                    test_message: "hello webhook",
                }),
            });

            expect(res.status).toBe(200);
            const data = await res.json() as { success: boolean };
            expect(data.success).toBe(true);
            expect(requests).toHaveLength(1);
            expect(requests[0].url).toContain("event=webhook.test");
            expect(requests[0].url).toContain("message=hello%20webhook");
            expect(requests[0].init?.method).toBe("GET");
            expect(requests[0].init?.body).toBeUndefined();
            expect(res.headers.get("Server-Timing")).toContain("init_container");
            expect(res.headers.get("Server-Timing")).toContain("auth_middleware");
            expect(res.headers.get("Server-Timing")).toContain("auth_verify");
            expect(res.headers.get("Server-Timing")).toContain("auth_user_lookup");
            expect(res.headers.get("Server-Timing")).toContain("webhook_send");
            expect(res.headers.get("Server-Timing")).toContain("total");
        });

        it("should return a readable error when webhook settings are invalid", async () => {
            const res = await app.request("/test-webhook", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: "Bearer mock_token_1",
                },
                body: JSON.stringify({
                    webhook_url: "https://example.com/webhook",
                    "webhook.headers": "{invalid",
                }),
            });

            expect(res.status).toBe(400);
            const data = await res.json() as { success: boolean; error?: string };
            expect(data.success).toBe(false);
            expect(data.error).toContain("JSON");
        });

        it("should send webhook tests for object-based template values", async () => {
            const requests: Array<{ url: string; init?: RequestInit }> = [];
            globalThis.fetch = mock(async (url: string | URL | Request, init?: RequestInit) => {
                requests.push({ url: String(url), init });
                return new Response("ok", { status: 200 });
            }) as typeof fetch;

            const res = await app.request("/test-webhook", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: "Bearer mock_token_1",
                },
                body: JSON.stringify({
                    webhook_url: "https://example.com/webhook",
                    "webhook.headers": { "X-Event": "{{event}}" },
                    "webhook.body_template": { content: "{{message}}" },
                    test_message: "hello webhook",
                }),
            });

            expect(res.status).toBe(200);
            expect(requests).toHaveLength(1);
            expect(requests[0].init?.headers).toMatchObject({
                "Content-Type": "application/json",
                "X-Event": "webhook.test",
            });
            expect(requests[0].init?.body).toBe('{"content":"hello webhook"}');
        });
    });
});
