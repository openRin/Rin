import { desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import type { AppContext } from "../core/hono-types";
import { apiKeys } from "../db/schema";
import { profileAsync } from "../core/server-timing";
import { generateApiKeySecret, getApiKeyPrefix, hashApiKey, parseApiKeyScopes } from "../utils/api-keys";

const DEFAULT_AGENT_SCOPES = [
    "content:read",
    "content:write",
    "moments:write",
    "media:write",
];

function requireInteractiveAdmin(c: AppContext) {
    if (!c.get("admin")) {
        return c.text("Unauthorized", 401);
    }

    if (c.get("authType") === "api-key") {
        return c.text("API keys cannot manage API keys", 403);
    }

    return null;
}

function serializeApiKeyRecord(record: typeof apiKeys.$inferSelect & {
    createdByUser?: {
        id: number;
        username: string;
    } | null;
}) {
    return {
        id: record.id,
        name: record.name,
        keyPrefix: record.keyPrefix,
        scopes: parseApiKeyScopes(record.scopes),
        createdAt: record.createdAt.toISOString(),
        updatedAt: record.updatedAt.toISOString(),
        lastUsedAt: record.lastUsedAt?.toISOString() ?? null,
        expiresAt: record.expiresAt?.toISOString() ?? null,
        revokedAt: record.revokedAt?.toISOString() ?? null,
        createdByUser: record.createdByUser
            ? {
                id: record.createdByUser.id,
                username: record.createdByUser.username,
            }
            : null,
    };
}

export function ApiKeyService(): Hono {
    const app = new Hono();

    app.get("/", async (c: AppContext) => {
        const unauthorized = requireInteractiveAdmin(c);
        if (unauthorized) {
            return unauthorized;
        }

        const db = c.get("db");
        const items = await profileAsync(c, "api_keys_list", () => db.query.apiKeys.findMany({
            with: {
                createdByUser: {
                    columns: {
                        id: true,
                        username: true,
                    },
                },
            },
            orderBy: [desc(apiKeys.createdAt)],
        }));

        return c.json({
            items: items.map((item) => serializeApiKeyRecord(item)),
        });
    });

    app.post("/", async (c: AppContext) => {
        const unauthorized = requireInteractiveAdmin(c);
        if (unauthorized) {
            return unauthorized;
        }

        const db = c.get("db");
        const uid = c.get("uid");
        const body = await profileAsync(c, "api_keys_create_parse", () => c.req.json()) as {
            name?: string;
            expiresAt?: string | null;
        };
        const name = body.name?.trim();

        if (!uid) {
            return c.text("Unauthorized", 401);
        }

        if (!name) {
            return c.text("Name is required", 400);
        }

        const expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;
        if (expiresAt && Number.isNaN(expiresAt.getTime())) {
            return c.text("Invalid expiration date", 400);
        }

        const secret = generateApiKeySecret();
        const now = new Date();
        const result = await profileAsync(c, "api_keys_create_insert", async () => {
            return db.insert(apiKeys).values({
                name,
                keyPrefix: getApiKeyPrefix(secret),
                keyHash: await hashApiKey(secret),
                scopes: JSON.stringify(DEFAULT_AGENT_SCOPES),
                createdByUid: uid,
                expiresAt: expiresAt ?? undefined,
                createdAt: now,
                updatedAt: now,
            }).returning();
        });

        const created = result[0];
        if (!created) {
            return c.text("Failed to create API key", 500);
        }

        return c.json({
            secret,
            apiKey: serializeApiKeyRecord(created),
        });
    });

    app.post("/:id/revoke", async (c: AppContext) => {
        const unauthorized = requireInteractiveAdmin(c);
        if (unauthorized) {
            return unauthorized;
        }

        const db = c.get("db");
        const id = Number(c.req.param("id"));
        if (!Number.isInteger(id) || id <= 0) {
            return c.text("Invalid API key id", 400);
        }

        const now = new Date();
        await profileAsync(c, "api_keys_revoke", () => db.update(apiKeys)
            .set({
                revokedAt: now,
                updatedAt: now,
            })
            .where(eq(apiKeys.id, id)));

        return c.json({ success: true });
    });

    return app;
}
