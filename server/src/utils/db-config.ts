import { eq } from "drizzle-orm";
import { getDB } from "./di";
import { info } from "../db/schema";

/**
 * Database-backed configuration storage for sensitive data like API keys
 * This stores configurations in the D1 database instead of S3
 */

// Prefix for AI summary related configurations
const AI_CONFIG_PREFIX = "ai_summary.";

export interface AIConfig {
    enabled: boolean;
    provider: string;
    model: string;
    api_key: string;
    api_url: string;
}

const defaultAIConfig: AIConfig = {
    enabled: false,
    provider: "openai",
    model: "gpt-4o-mini",
    api_key: "",
    api_url: "https://api.openai.com/v1/chat/completions",
};

/**
 * Get a configuration value from the database
 */
export async function getDBConfig(key: string): Promise<string | null> {
    const db = getDB();
    const result = await db.select().from(info).where(eq(info.key, key)).get();
    return result?.value ?? null;
}

/**
 * Set a configuration value in the database (upsert)
 */
export async function setDBConfig(key: string, value: string): Promise<void> {
    const db = getDB();
    // Use SQLite's INSERT OR REPLACE to handle upsert
    await db.insert(info)
        .values({ key, value })
        .onConflictDoUpdate({
            target: info.key,
            set: { value }
        });
}

/**
 * Get AI configuration from database
 */
export async function getAIConfig(): Promise<AIConfig> {
    const config: AIConfig = { ...defaultAIConfig };

    const enabled = await getDBConfig(AI_CONFIG_PREFIX + "enabled");
    if (enabled !== null) config.enabled = enabled === "true";

    const provider = await getDBConfig(AI_CONFIG_PREFIX + "provider");
    if (provider !== null) config.provider = provider;

    const model = await getDBConfig(AI_CONFIG_PREFIX + "model");
    if (model !== null) config.model = model;

    const apiKey = await getDBConfig(AI_CONFIG_PREFIX + "api_key");
    if (apiKey !== null) config.api_key = apiKey;

    const apiUrl = await getDBConfig(AI_CONFIG_PREFIX + "api_url");
    if (apiUrl !== null) config.api_url = apiUrl;

    return config;
}

/**
 * Set AI configuration in database
 */
export async function setAIConfig(updates: Partial<AIConfig>): Promise<void> {
    if (updates.enabled !== undefined) {
        await setDBConfig(AI_CONFIG_PREFIX + "enabled", String(updates.enabled));
    }
    if (updates.provider !== undefined) {
        await setDBConfig(AI_CONFIG_PREFIX + "provider", updates.provider);
    }
    if (updates.model !== undefined) {
        await setDBConfig(AI_CONFIG_PREFIX + "model", updates.model);
    }
    if (updates.api_key !== undefined && updates.api_key.trim() !== "") {
        // Only update API key if a new value is provided
        await setDBConfig(AI_CONFIG_PREFIX + "api_key", updates.api_key);
    }
    if (updates.api_url !== undefined) {
        await setDBConfig(AI_CONFIG_PREFIX + "api_url", updates.api_url);
    }
}

/**
 * Get AI config for frontend (with masked API key)
 */
export async function getAIConfigForFrontend(): Promise<AIConfig & { api_key_set: boolean }> {
    const config = await getAIConfig();
    return {
        ...config,
        api_key: "", // Never expose the actual key
        api_key_set: config.api_key.length > 0,
    };
}
