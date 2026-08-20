import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import type { Database } from "bun:sqlite";
import { Hono } from "hono";
import type { Variables } from "../../core/hono-types";
import { feeds } from "../../db/schema";
import { cleanupTestDB, createTestUser, setupTestApp, type TestCacheImpl } from "../../../tests/fixtures";
import { SearchService } from "../feed";

describe("SearchService", () => {
    let db: any;
    let sqlite: Database;
    let env: Env;
    let app: Hono<{ Bindings: Env; Variables: Variables }>;
    let clientConfig: TestCacheImpl;

    beforeEach(async () => {
        const context = await setupTestApp(SearchService);
        db = context.db;
        sqlite = context.sqlite;
        env = context.env;
        app = context.app;
        clientConfig = context.clientConfig;
        await createTestUser(sqlite);
    });

    afterEach(() => {
        cleanupTestDB(sqlite);
    });

    it("paginates matching feeds in the database while preserving the response shape", async () => {
        await db.insert(feeds).values([
            { title: "Needle 1", content: "one", uid: 1, draft: 0, listed: 1 },
            { title: "Needle 2", content: "two", uid: 1, draft: 0, listed: 1 },
            { title: "Needle 3", content: "three", uid: 1, draft: 0, listed: 1 },
        ]);

        const firstResponse = await app.request("/Needle?page=1&limit=2", {}, env);
        const firstPage = await firstResponse.json() as any;

        expect(firstResponse.status).toBe(200);
        expect(firstPage.size).toBe(3);
        expect(firstPage.data).toHaveLength(2);
        expect(firstPage.hasNext).toBe(true);

        const secondResponse = await app.request("/Needle?page=2&limit=2", {}, env);
        const secondPage = await secondResponse.json() as any;

        expect(secondResponse.status).toBe(200);
        expect(secondPage.size).toBe(3);
        expect(secondPage.data).toHaveLength(1);
        expect(secondPage.hasNext).toBe(false);
    });

    it("isolates administrator search cache entries from public results", async () => {
        await clientConfig.set("cache.enabled", true);
        await db.insert(feeds).values([
            { title: "Shared result", content: "visible", uid: 1, draft: 0, listed: 1 },
            { title: "Shared draft", content: "private", uid: 1, draft: 1, listed: 1 },
        ]);

        const adminResponse = await app.request("/Shared", {
            headers: { Authorization: "Bearer mock_token_1" },
        }, env);
        const adminResult = await adminResponse.json() as any;
        expect(adminResult.size).toBe(2);

        const publicResponse = await app.request("/Shared", {}, env);
        const publicResult = await publicResponse.json() as any;

        expect(publicResponse.status).toBe(200);
        expect(publicResult.size).toBe(1);
        expect(publicResult.data).toHaveLength(1);
        expect(publicResult.data[0].title).toBe("Shared result");
    });
});
