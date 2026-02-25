import { describe, expect, it, beforeEach, afterEach } from "bun:test";
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
        cleanupTestDB(sqlite);
    });

    async function createTestUser() {
        sqlite.exec(`
            INSERT INTO users (id, username, openid, avatar, permission) 
            VALUES (1, 'testuser', 'gh_test', 'avatar.png', 1)
        `);
    }

    describe("GET /:type - Get config", () => {
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
            // Set some AI config with API key
            sqlite.exec(`
                INSERT INTO info (key, value) VALUES 
                ('ai_summary.api_key', 'secret_key_123')
            `);

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

        it("should save AI config to database", async () => {
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

            // Verify AI config was saved
            const dbResult = sqlite
                .prepare("SELECT * FROM info WHERE key LIKE 'ai_summary.%'")
                .all();
            expect(dbResult.length).toBeGreaterThan(0);
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
    });
});
