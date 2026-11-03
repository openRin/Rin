import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import type { Database } from "bun:sqlite";
import { buildServerConfigResponse, getClientConfigWithDefaults, resolveWebhookConfig } from "../config-helpers";
import { cleanupTestDB, createMockDB } from "../../../tests/fixtures";

describe("buildServerConfigResponse", () => {
    let sqlite: Database;

    beforeEach(async () => {
        const mockDB = createMockDB();
        sqlite = mockDB.sqlite;
    });

    afterEach(() => {
        cleanupTestDB(sqlite);
    });

    it("stringifies object-based webhook template values", async () => {
        const response = await buildServerConfigResponse({
            async all() {
                return new Map<string, unknown>([
                    ["webhook.headers", { "X-Event": "{{event}}" }],
                    ["webhook.body_template", { content: "{{message}}" }],
                ]);
            },
            async set() {},
            async save() {},
        });

        expect(response["webhook.headers"]).toBe('{"X-Event":"{{event}}"}');
        expect(response["webhook.body_template"]).toBe('{"content":"{{message}}"}');
    });

    it("uses WEBHOOK_URL env as fallback when webhook_url is not stored", async () => {
        const response = await buildServerConfigResponse({
            async all() {
                return new Map<string, unknown>();
            },
            async set() {},
            async save() {},
        }, {
            WEBHOOK_URL: "https://env.example.com/webhook",
        });

        expect(response["webhook_url"]).toBe("https://env.example.com/webhook");
        expect(response["WEBHOOK_URL"]).toBe("https://env.example.com/webhook");
    });

    it("prefers stored webhook_url over WEBHOOK_URL env fallback", async () => {
        const response = await buildServerConfigResponse({
            async all() {
                return new Map<string, unknown>([
                    ["webhook_url", "https://stored.example.com/webhook"],
                ]);
            },
            async set() {},
            async save() {},
        }, {
            WEBHOOK_URL: "https://env.example.com/webhook",
        });

        expect(response["webhook_url"]).toBe("https://stored.example.com/webhook");
    });
});

describe("getClientConfigWithDefaults", () => {
    function createConfigMap(stored: Record<string, unknown>) {
        return {
            async all() {
                return new Map<string, unknown>(Object.entries(stored));
            },
            async set() {},
            async save() {},
        };
    }

    it("fills unset keys from env defaults", async () => {
        const result = await getClientConfigWithDefaults(createConfigMap({}), {
            NAME: "Env Name",
            DESCRIPTION: "Env Description",
        } as any);

        expect(result["site.name"]).toBe("Env Name");
        expect(result["site.description"]).toBe("Env Description");
    });

    it("keeps explicitly cleared values instead of reverting to env defaults", async () => {
        const result = await getClientConfigWithDefaults(
            createConfigMap({ "site.description": "" }),
            { DESCRIPTION: "Env Description" } as any,
        );

        expect(result["site.description"]).toBe("");
    });

    it("defaults page_size to 5 only when not stored", async () => {
        const cleared = await getClientConfigWithDefaults(
            createConfigMap({ "site.page_size": "" }),
            {} as any,
        );
        expect(cleared["site.page_size"]).toBe("");

        const unset = await getClientConfigWithDefaults(createConfigMap({}), {} as any);
        expect(unset["site.page_size"]).toBe(5);
    });
});

describe("resolveWebhookConfig", () => {
    it("prefers stored webhook_url over the legacy key and env fallback", async () => {
        const config = await resolveWebhookConfig({
            async get(key: string) {
                if (key === "webhook_url") {
                    return "https://stored.example.com/webhook";
                }
                if (key === "WEBHOOK_URL") {
                    return "https://legacy.example.com/webhook";
                }
                return undefined;
            },
        }, {
            WEBHOOK_URL: "https://env.example.com/webhook",
        });

        expect(config.webhookUrl).toBe("https://stored.example.com/webhook");
    });

    it("uses body overrides before stored config values", async () => {
        const config = await resolveWebhookConfig({
            async get(key: string) {
                if (key === "webhook_url") {
                    return "https://stored.example.com/webhook";
                }
                if (key === "webhook.method") {
                    return "POST";
                }
                return undefined;
            },
        }, {
            WEBHOOK_URL: "https://env.example.com/webhook",
        }, {
            webhook_url: "https://override.example.com/webhook",
            "webhook.method": "GET",
        });

        expect(config.webhookUrl).toBe("https://override.example.com/webhook");
        expect(config.webhookMethod).toBe("GET");
    });
});
