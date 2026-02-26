import { Hono } from "hono";
import { startTime, endTime } from "hono/timing";
import type { AppContext } from "../core/hono-types";
import { getAIConfigForFrontend, setAIConfig, getAIConfig } from "../utils/db-config";
import { testAIModel } from "../utils/ai";

// Sensitive fields that should not be exposed to frontend
const SENSITIVE_FIELDS = ['ai_summary.api_key'];

// AI config keys mapping (flat key -> nested structure)
const AI_CONFIG_KEYS = ['ai_summary.enabled', 'ai_summary.provider', 'ai_summary.model', 'ai_summary.api_key', 'ai_summary.api_url'];

// Client config keys that should use environment variables as defaults
const CLIENT_CONFIG_ENV_DEFAULTS: Record<string, string> = {
    'site.name': 'NAME',
    'site.description': 'DESCRIPTION',
    'site.avatar': 'AVATAR',
    'site.page_size': 'PAGE_SIZE',
};

function maskSensitiveFields(config: Record<string, any>): Record<string, any> {
    const result: Record<string, any> = {};
    for (const key in config) {
        const value = config[key];
        if (SENSITIVE_FIELDS.includes(key) && value) {
            result[key] = '••••••••';
        } else {
            result[key] = value;
        }
    }
    return result;
}

// Check if key is an AI config key
function isAIConfigKey(key: string): boolean {
    return AI_CONFIG_KEYS.includes(key) || key.startsWith('ai_summary.');
}

// Get client config with environment variable defaults
async function getClientConfigWithDefaults(
    clientConfig: any,
    env: Env
): Promise<Record<string, any>> {
    const all = await clientConfig.all();
    const result: Record<string, any> = Object.fromEntries(all);

    // Apply environment variable defaults for unset configs
    for (const [configKey, envKey] of Object.entries(CLIENT_CONFIG_ENV_DEFAULTS)) {
        if (result[configKey] === undefined || result[configKey] === '') {
            const envValue = env[envKey as keyof Env];
            if (envValue) {
                result[configKey] = envValue;
            }
        }
    }

    // Set default page_size if not set
    if (result['site.page_size'] === undefined || result['site.page_size'] === '') {
        result['site.page_size'] = 5;
    }

    return result;
}

export function ConfigService(): Hono {
    const app = new Hono();

    // POST /config/test-ai - Test AI model configuration
    // NOTE: Must be defined BEFORE /:type route to avoid being captured as a type parameter
    app.post('/test-ai', async (c: AppContext) => {
        startTime(c, 'config-test-ai');
        const admin = c.get('admin');

        if (!admin) {
            endTime(c, 'config-test-ai');
            return c.json({ error: 'Unauthorized' }, 401);
        }

        const db = c.get('db');
        const env = c.get('env');
        const body = await c.req.json();

        // Get current AI config from database
        startTime(c, 'db-get-ai-config');
        const config = await getAIConfig(db);
        endTime(c, 'db-get-ai-config');

        // Build test config with overrides
        const testConfig = {
            provider: body.provider || config.provider,
            model: body.model || config.model,
            api_url: body.api_url !== undefined ? body.api_url : config.api_url,
            api_key: body.api_key !== undefined ? body.api_key : config.api_key,
        };

        // Test prompt
        const testPrompt = body.testPrompt || "Hello! This is a test message. Please respond with a simple greeting.";

        // Use unified test function
        startTime(c, 'ai-test');
        const result = await testAIModel(env, testConfig, testPrompt);
        endTime(c, 'ai-test');
        endTime(c, 'config-test-ai');
        return c.json(result);
    });

    // GET /config/:type
    app.get('/:type', async (c: AppContext) => {
        startTime(c, 'config-get');
        const admin = c.get('admin');
        const type = c.req.param('type');

        if (type !== 'server' && type !== 'client') {
            endTime(c, 'config-get');
            return c.text('Invalid type', 400);
        }

        if (type === 'server' && !admin) {
            endTime(c, 'config-get');
            return c.text('Unauthorized', 401);
        }

        const db = c.get('db');
        const serverConfig = c.get('serverConfig');
        const clientConfig = c.get('clientConfig');
        const env = c.get('env');

        // Server config: includes regular server config + AI config
        if (type === 'server') {
            startTime(c, 'config-all');
            const all = await serverConfig.all();
            endTime(c, 'config-all');
            const configObj = Object.fromEntries(all);

            // Get AI config and merge into server config with flattened keys
            startTime(c, 'db-get-ai-config');
            const aiConfig = await getAIConfigForFrontend(db);
            endTime(c, 'db-get-ai-config');
            configObj['ai_summary.enabled'] = String(aiConfig.enabled);
            configObj['ai_summary.provider'] = aiConfig.provider;
            configObj['ai_summary.model'] = aiConfig.model;
            configObj['ai_summary.api_url'] = aiConfig.api_url;
            configObj['ai_summary.api_key'] = aiConfig.api_key_set ? '••••••••' : '';

            endTime(c, 'config-get');
            return c.json(maskSensitiveFields(configObj));
        }

        // Client config: apply environment variable defaults and include AI summary status
        startTime(c, 'client-config-get');
        const clientConfigData = await getClientConfigWithDefaults(clientConfig, env);
        endTime(c, 'client-config-get');
        startTime(c, 'db-get-ai-config');
        const aiConfig = await getAIConfigForFrontend(db);
        endTime(c, 'db-get-ai-config');
        endTime(c, 'config-get');
        return c.json({
            ...clientConfigData,
            'ai_summary.enabled': aiConfig.enabled ?? false
        });
    });

    // POST /config/:type
    app.post('/:type', async (c: AppContext) => {
        startTime(c, 'config-post');
        const admin = c.get('admin');
        const type = c.req.param('type');
        
        if (type !== 'server' && type !== 'client') {
            endTime(c, 'config-post');
            return c.text('Invalid type', 400);
        }
        
        if (!admin) {
            endTime(c, 'config-post');
            return c.text('Unauthorized', 401);
        }
        
        const db = c.get('db');
        const serverConfig = c.get('serverConfig');
        const clientConfig = c.get('clientConfig');
        const body = await c.req.json();
        
        // Separate AI config from regular config
        const regularConfig: Record<string, any> = {};
        const aiConfigUpdates: Record<string, any> = {};
        
        for (const key in body) {
            if (isAIConfigKey(key)) {
                // Convert flat key to nested key for AI config
                const nestedKey = key.replace('ai_summary.', '');
                aiConfigUpdates[nestedKey] = body[key];
            } else {
                regularConfig[key] = body[key];
            }
        }
        
        // Save regular config
        const config = type === 'server' ? serverConfig : clientConfig;
        startTime(c, 'config-save');
        for (const key in regularConfig) {
            await config.set(key, regularConfig[key], false);
        }
        await config.save();
        endTime(c, 'config-save');
        
        // Save AI config if there are any AI config updates
        if (Object.keys(aiConfigUpdates).length > 0) {
            startTime(c, 'db-set-ai-config');
            await setAIConfig(db, aiConfigUpdates);
            endTime(c, 'db-set-ai-config');
        }
        
        endTime(c, 'config-post');
        return c.text('OK');
    });

    // DELETE /config/cache
    app.delete('/cache', async (c: AppContext) => {
        startTime(c, 'config-cache-clear');
        const admin = c.get('admin');
        
        if (!admin) {
            endTime(c, 'config-cache-clear');
            return c.text('Unauthorized', 401);
        }
        
        const cache = c.get('cache');
        startTime(c, 'cache-clear');
        await cache.clear();
        endTime(c, 'cache-clear');
        endTime(c, 'config-cache-clear');
        return c.text('OK');
    });

    return app;
}
