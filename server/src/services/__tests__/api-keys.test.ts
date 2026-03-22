import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import type { Database } from "bun:sqlite";
import { Hono } from "hono";
import { createMiddleware } from "hono/factory";
import { authMiddleware } from "../../core/hono-middleware";
import type { Variables } from "../../core/hono-types";
import type { ApiKeyListResponse, CreateApiKeyResponse } from "@rin/api";
import { FeedService } from "../feed";
import { ApiKeyService } from "../api-keys";
import { ConfigService } from "../config";
import { UserService } from "../user";
import { hashApiKey } from "../../utils/api-keys";
import {
    TestCacheImpl,
    cleanupTestDB,
    createMockDB,
    createMockEnv,
} from "../../../tests/fixtures";

describe("ApiKeyService", () => {
    let db: any;
    let sqlite: Database;
    let env: Env;
    let app: Hono<{ Bindings: Env; Variables: Variables }>;

    beforeEach(() => {
        const mockDB = createMockDB();
        db = mockDB.db;
        sqlite = mockDB.sqlite;
        env = createMockEnv({
            ADMIN_USERNAME: "admin",
            ADMIN_PASSWORD: "admin123",
        });

        sqlite.exec(`
            INSERT INTO users (id, username, avatar, openid, password, permission)
            VALUES (1, 'admin', '', 'admin', 'hashed', 1)
        `);

        app = new Hono<{ Bindings: Env; Variables: Variables }>();
        app.use(createMiddleware(async (c, next) => {
            c.set("db", db);
            c.set("env", env);
            c.set("admin", true);
            c.set("uid", 1);
            c.set("username", "admin");
            c.set("authType", "jwt");
            await next();
        }));
        app.route("/api-keys", ApiKeyService());
    });

    afterEach(() => {
        cleanupTestDB(sqlite);
    });

    it("creates, lists, and revokes an API key", async () => {
        const createResponse = await app.request("/api-keys", {
            method: "POST",
            headers: {
                "content-type": "application/json",
            },
            body: JSON.stringify({
                name: "Agent Writer",
            }),
        }, env);
        expect(createResponse.status).toBe(200);
        const created = await createResponse.json() as CreateApiKeyResponse;
        expect(created.secret.startsWith("rin_")).toBe(true);
        expect(created.apiKey.name).toBe("Agent Writer");
        expect(created.apiKey.scopes).toContain("content:write");

        const listResponse = await app.request("/api-keys", { method: "GET" }, env);
        expect(listResponse.status).toBe(200);
        const listed = await listResponse.json() as ApiKeyListResponse;
        expect(listed.items).toHaveLength(1);
        expect(listed.items[0].keyPrefix).toBe(created.apiKey.keyPrefix);
        expect(listed.items[0].revokedAt).toBeNull();

        const revokeResponse = await app.request(`/api-keys/${created.apiKey.id}/revoke`, {
            method: "POST",
        }, env);
        expect(revokeResponse.status).toBe(200);

        const afterRevokeResponse = await app.request("/api-keys", { method: "GET" }, env);
        const afterRevoke = await afterRevokeResponse.json() as ApiKeyListResponse;
        expect(afterRevoke.items[0].revokedAt).not.toBeNull();
    });
});

describe("API key auth middleware", () => {
    let db: any;
    let sqlite: Database;
    let env: Env;
    let app: Hono<{ Bindings: Env; Variables: Variables }>;

    beforeEach(async () => {
        const mockDB = createMockDB();
        db = mockDB.db;
        sqlite = mockDB.sqlite;
        env = createMockEnv({
            ADMIN_USERNAME: "admin",
            ADMIN_PASSWORD: "admin123",
        });

        sqlite.exec(`
            INSERT INTO users (id, username, avatar, openid, password, permission)
            VALUES (1, 'admin', '', 'admin', 'hashed', 1)
        `);

        const secret = "rin_test_agent_key";
        sqlite.exec(`
            INSERT INTO api_keys (id, name, key_prefix, key_hash, scopes, created_by_uid)
            VALUES (
                1,
                'Agent Writer',
                'rin_test_age',
                '${await hashApiKey(secret)}',
                '["content:read","content:write","moments:write","media:write"]',
                1
            )
        `);

        const cache = new TestCacheImpl();
        const clientConfig = new TestCacheImpl();
        const serverConfig = new TestCacheImpl();

        app = new Hono<{ Bindings: Env; Variables: Variables }>();
        app.use(createMiddleware(async (c, next) => {
            c.set("db", db);
            c.set("env", env);
            c.set("cache", cache);
            c.set("clientConfig", clientConfig);
            c.set("serverConfig", serverConfig);
            c.set("jwt", {
                sign: async (payload: any) => `mock_token_${payload.id}`,
                verify: async (token: string) => {
                    const match = token.match(/mock_token_(\d+)/);
                    return match ? { id: Number(match[1]) } : null;
                },
            });
            c.set("admin", false);
            await next();
        }));
        app.use("*", authMiddleware);
        app.route("/feed", FeedService());
        app.route("/config", ConfigService());
        app.route("/user", UserService());
    });

    afterEach(() => {
        cleanupTestDB(sqlite);
    });

    it("allows documented content routes with a bearer API key and blocks other routes", async () => {
        const createFeedResponse = await app.request("/feed", {
            method: "POST",
            headers: {
                authorization: "Bearer rin_test_agent_key",
                "content-type": "application/json",
            },
            body: JSON.stringify({
                title: "Agent-created post",
                content: "Hello from an external agent.",
                summary: "Summary",
                alias: "agent-created-post",
                draft: false,
                listed: true,
                tags: [],
            }),
        }, env);

        expect(createFeedResponse.status).toBe(200);
        const createdFeed = await createFeedResponse.json() as { insertedId?: number };
        expect(createdFeed.insertedId).toBeDefined();

        const configResponse = await app.request("/config", {
            method: "GET",
            headers: {
                authorization: "Bearer rin_test_agent_key",
            },
        }, env);
        expect(configResponse.status).toBe(403);

        const userProfileResponse = await app.request("/user/profile", {
            method: "GET",
            headers: {
                authorization: "Bearer rin_test_agent_key",
            },
        }, env);
        expect(userProfileResponse.status).toBe(403);

        const keyRecord = sqlite.prepare("SELECT last_used_at FROM api_keys WHERE id = 1").get() as { last_used_at: number | null };
        expect(keyRecord.last_used_at).not.toBeNull();
    });

    it("enforces stored API key scopes on allowed routes", async () => {
        const readOnlySecret = "rin_test_read_only_key";
        sqlite.exec(`
            INSERT INTO api_keys (id, name, key_prefix, key_hash, scopes, created_by_uid)
            VALUES (
                2,
                'Read Only Agent',
                'rin_test_rea',
                '${await hashApiKey(readOnlySecret)}',
                '["content:read"]',
                1
            )
        `);

        const createFeedResponse = await app.request("/feed", {
            method: "POST",
            headers: {
                authorization: `Bearer ${readOnlySecret}`,
                "content-type": "application/json",
            },
            body: JSON.stringify({
                title: "Read-only should fail",
                content: "Blocked write",
                summary: "Blocked write",
                alias: "read-only-should-fail",
                draft: true,
                listed: false,
                tags: [],
            }),
        }, env);

        expect(createFeedResponse.status).toBe(403);
    });
});
