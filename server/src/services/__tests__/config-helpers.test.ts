import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import type { Database } from "bun:sqlite";
import { buildServerConfigResponse } from "../config-helpers";
import { cleanupTestDB, createMockDB } from "../../../tests/fixtures";

describe("buildServerConfigResponse", () => {
    let db: any;
    let sqlite: Database;

    beforeEach(async () => {
        const mockDB = createMockDB();
        db = mockDB.db;
        sqlite = mockDB.sqlite;
    });

    afterEach(() => {
        cleanupTestDB(sqlite);
    });

    it("stringifies object-based webhook template values", async () => {
        const response = await buildServerConfigResponse(db, {
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
});
