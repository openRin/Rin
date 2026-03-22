import { Hono } from "hono";
import { wrapTime } from "hono/timing";
import type { AppContext } from "../core/hono-types";
import { setAIConfig, getAIConfig } from "../utils/db-config";
import { testAIModel } from "../utils/ai";
import { notify } from "../utils/webhook";
import {
    buildCombinedConfigResponse,
    buildClientConfigResponse,
    buildServerConfigResponse,
    isConfigType,
    persistRegularConfig,
    resolveWebhookConfig,
    splitConfigPayload,
} from "./config-helpers";
import { buildHealthCheckResponse } from "./config-health";
import { buildQueueStatusResponse, deleteQueueStatusTask, retryQueueStatusTask } from "./config-queue-status";
import { profileAsync } from "../core/server-timing";
import {
    applyBlurhashCompatUpdate,
    buildCompatTasksResponse,
    listBlurhashCompatCandidates,
    runCompatAISummaryBackfill,
} from "./config-compat-tasks";

export function ConfigService(): Hono {
    const app = new Hono();

    function serializeBootstrapScript(config: Record<string, unknown>) {
        const serialized = JSON.stringify(config)
            .replace(/</g, "\\u003C")
            .replace(/>/g, "\\u003E")
            .replace(/&/g, "\\u0026")
            .replace(/\u2028/g, "\\u2028")
            .replace(/\u2029/g, "\\u2029");

        return `globalThis.__RIN_CLIENT_CONFIG__=${serialized};`;
    }

    // POST /config/test-ai - Test AI model configuration
    // NOTE: Must be defined BEFORE /:type route to avoid being captured as a type parameter
    app.post('/test-ai', async (c: AppContext) => {
        const admin = c.get('admin');

        if (!admin) {
            return c.json({ error: 'Unauthorized' }, 401);
        }

        const env = c.get('env');
        const serverConfig = c.get('serverConfig');
        const body = await wrapTime(c, 'request_body', c.req.json());

        // Get current AI config from database
        const config = await wrapTime(c, 'ai_config', getAIConfig(serverConfig));

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
        const result = await wrapTime(c, 'ai_test', testAIModel(env, testConfig, testPrompt));
        return c.json(result);
    });

    app.post('/test-webhook', async (c: AppContext) => {
        const admin = c.get('admin');

        if (!admin) {
            return c.json({ error: 'Unauthorized' }, 401);
        }

        const env = c.get('env');
        const serverConfig = c.get('serverConfig');
        const body = await wrapTime(c, 'request_body', c.req.json()) as {
            webhook_url?: string;
            "webhook.method"?: string;
            "webhook.content_type"?: string;
            "webhook.headers"?: string;
            "webhook.body_template"?: string;
            test_message?: string;
        };

        const {
            webhookUrl,
            webhookMethod: resolvedWebhookMethod,
            webhookContentType: resolvedWebhookContentType,
            webhookHeaders: resolvedWebhookHeaders,
            webhookBodyTemplate: resolvedWebhookBodyTemplate,
        } = await wrapTime(c, 'webhook_config', resolveWebhookConfig(serverConfig, env, body));
        const frontendUrl = new URL(c.req.url).origin;
        const testMessage = body.test_message?.trim() || "This is a test webhook message from Rin settings.";

        if (!webhookUrl?.trim()) {
            return c.json({ success: false, error: "Webhook URL is required" }, 400);
        }

        try {
            const response = await wrapTime(c, 'webhook_send', notify(
                    webhookUrl,
                    {
                        event: "webhook.test",
                        message: testMessage,
                        title: "Webhook Test",
                        url: `${frontendUrl}/admin/settings`,
                        username: "admin",
                        content: testMessage,
                        description: "Manual webhook test triggered from settings.",
                    },
                    {
                        method: resolvedWebhookMethod,
                        contentType: resolvedWebhookContentType,
                        headers: resolvedWebhookHeaders,
                        bodyTemplate: resolvedWebhookBodyTemplate,
                    },
                ));

            if (!response) {
                return c.json({ success: false, error: "Webhook request was not sent" }, 400);
            }

            if (!response.ok) {
                const details = await response.text();
                return c.json({
                    success: false,
                    error: `Webhook test failed with status ${response.status}`,
                    details,
                }, 400);
            }

            return c.json({ success: true });
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            return c.json({ success: false, error: message }, 400);
        }
    });

    // GET /config
    app.get('/', async (c: AppContext) => {
        const admin = c.get('admin');

        if (!admin) {
            return c.text('Unauthorized', 401);
        }

        const serverConfig = c.get('serverConfig');
        const clientConfig = c.get('clientConfig');
        const env = c.get('env');

        return c.json(await wrapTime(c, 'config_response', buildCombinedConfigResponse(clientConfig, serverConfig, env)));
    });

    // GET /config/health
    app.get('/health', async (c: AppContext) => {
        const admin = c.get('admin');

        if (!admin) {
            return c.text('Unauthorized', 401);
        }

        const serverConfig = c.get('serverConfig');
        const clientConfig = c.get('clientConfig');
        const env = c.get('env');

        return c.json(await wrapTime(c, 'health_check', buildHealthCheckResponse(clientConfig, serverConfig, env)));
    });

    app.get('/queue-status', async (c: AppContext) => {
        const admin = c.get('admin');

        if (!admin) {
            return c.text('Unauthorized', 401);
        }

        const db = c.get('db');
        const env = c.get('env');

        return c.json(await wrapTime(c, 'queue_status', buildQueueStatusResponse(db, env)));
    });

    app.get('/compat-tasks', async (c: AppContext) => {
        const admin = c.get('admin');

        if (!admin) {
            return c.text('Unauthorized', 401);
        }

        return c.json(await wrapTime(c, 'compat_tasks', buildCompatTasksResponse(c.get('db'), c.get('serverConfig'), c.get('env'))));
    });

    app.post('/compat-tasks/ai-summary', async (c: AppContext) => {
        const admin = c.get('admin');

        if (!admin) {
            return c.text('Unauthorized', 401);
        }

        try {
            const body = c.req.header('content-type')?.includes('application/json')
                ? await wrapTime(c, 'request_body', c.req.json()) as { force?: boolean }
                : {};
            return c.json(await wrapTime(c, 'compat_ai_summary', runCompatAISummaryBackfill(c.get('db'), c.get('cache'), c.get('serverConfig'), c.get('env'), Boolean(body.force))));
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            return c.text(message, 400);
        }
    });

    app.get('/compat-tasks/blurhash', async (c: AppContext) => {
        const admin = c.get('admin');

        if (!admin) {
            return c.text('Unauthorized', 401);
        }

        return c.json(await wrapTime(c, 'compat_blurhash_list', listBlurhashCompatCandidates(c.get('db'))));
    });

    app.post('/compat-tasks/blurhash/:id', async (c: AppContext) => {
        const admin = c.get('admin');

        if (!admin) {
            return c.text('Unauthorized', 401);
        }

        const id = Number(c.req.param('id'));
        if (!Number.isInteger(id) || id <= 0) {
            return c.text('Invalid feed id', 400);
        }

        const body = await wrapTime(c, 'request_body', c.req.json()) as { content?: string };
        if (!body.content) {
            return c.text('Content is required', 400);
        }

        try {
            return c.json(await wrapTime(c, 'compat_blurhash_apply', applyBlurhashCompatUpdate(c.get('db'), c.get('cache'), id, body.content)));
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            const status = message === 'Feed not found' ? 404 : 400;
            return c.text(message, status);
        }
    });

    app.post('/queue-status/:id/retry', async (c: AppContext) => {
        const admin = c.get('admin');

        if (!admin) {
            return c.text('Unauthorized', 401);
        }

        const id = Number(c.req.param('id'));
        if (!Number.isInteger(id) || id <= 0) {
            return c.text('Invalid feed id', 400);
        }

        try {
            await wrapTime(c, 'queue_retry', retryQueueStatusTask(c.get('db'), c.get('cache'), c.get('serverConfig'), c.get('env'), id));
            return c.json({ success: true });
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            const status = message === 'Feed not found' ? 404 : 400;
            return c.text(message, status);
        }
    });

    app.delete('/queue-status/:id', async (c: AppContext) => {
        const admin = c.get('admin');

        if (!admin) {
            return c.text('Unauthorized', 401);
        }

        const id = Number(c.req.param('id'));
        if (!Number.isInteger(id) || id <= 0) {
            return c.text('Invalid feed id', 400);
        }

        try {
            await wrapTime(c, 'queue_delete', deleteQueueStatusTask(c.get('db'), c.get('cache'), id));
            return c.json({ success: true });
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            const status = message === 'Feed not found' ? 404 : 400;
            return c.text(message, status);
        }
    });

    app.get('/client/bootstrap.js', async (c: AppContext) => {
        const clientConfig = c.get('clientConfig');
        const serverConfig = c.get('serverConfig');
        const env = c.get('env');
        const profile = <T>(name: string, task: () => Promise<T>) => profileAsync(c, name, task);
        const config = await profileAsync(c, 'bootstrap_client_config', () => buildClientConfigResponse(clientConfig, serverConfig, env, profile));
        const script = await profileAsync(c, 'bootstrap_script', () => Promise.resolve(serializeBootstrapScript(config)));

        return new Response(script, {
            status: 200,
            headers: {
                'content-type': 'application/javascript; charset=utf-8',
                'cache-control': 'public, max-age=0, must-revalidate',
            },
        });
    });

    // GET /config/:type
    app.get('/:type', async (c: AppContext) => {
        const admin = c.get('admin');
        const type = c.req.param('type');
        
        if (!isConfigType(type)) {
            return c.text('Invalid type', 400);
        }
        
        if (type === 'server' && !admin) {
            return c.text('Unauthorized', 401);
        }
        
        const serverConfig = c.get('serverConfig');
        const clientConfig = c.get('clientConfig');
        const env = c.get('env');
        
        if (type === 'server') {
            return c.json(await buildServerConfigResponse(serverConfig, env));
        }
        
        return c.json(await buildClientConfigResponse(clientConfig, serverConfig, env));
    });

    // POST /config
    app.post('/', async (c: AppContext) => {
        const admin = c.get('admin');

        if (!admin) {
            return c.text('Unauthorized', 401);
        }

        const serverConfig = c.get('serverConfig');
        const clientConfig = c.get('clientConfig');
        const env = c.get('env');
        const body = await c.req.json() as {
            clientConfig?: Record<string, unknown>;
            serverConfig?: Record<string, unknown>;
        };

        const nextClientConfig = body.clientConfig ?? {};
        const nextServerConfig = body.serverConfig ?? {};

        const { regularConfig: regularClientConfig } = splitConfigPayload(nextClientConfig);
        const { regularConfig: regularServerConfig, aiConfigUpdates } = splitConfigPayload(nextServerConfig);

        await Promise.all([
            persistRegularConfig(clientConfig, regularClientConfig),
            persistRegularConfig(serverConfig, regularServerConfig),
        ]);

        if (Object.keys(aiConfigUpdates).length > 0) {
            await setAIConfig(serverConfig, aiConfigUpdates);
        }

        return c.json(await buildCombinedConfigResponse(clientConfig, serverConfig, env));
    });

    // POST /config/:type
    app.post('/:type', async (c: AppContext) => {
        const admin = c.get('admin');
        const type = c.req.param('type');
        
        if (!isConfigType(type)) {
            return c.text('Invalid type', 400);
        }
        
        if (!admin) {
            return c.text('Unauthorized', 401);
        }
        
        const serverConfig = c.get('serverConfig');
        const clientConfig = c.get('clientConfig');
        const body = await c.req.json();
        const { regularConfig, aiConfigUpdates } = splitConfigPayload(body);
        
        const config = type === 'server' ? serverConfig : clientConfig;
        await persistRegularConfig(config, regularConfig);
        
        if (Object.keys(aiConfigUpdates).length > 0) {
            await setAIConfig(serverConfig, aiConfigUpdates);
        }
        
        return c.text('OK');
    });

    // DELETE /config/cache
    app.delete('/cache', async (c: AppContext) => {
        const admin = c.get('admin');
        
        if (!admin) {
            return c.text('Unauthorized', 401);
        }
        
        const cache = c.get('cache');
        await cache.clear();
        return c.text('OK');
    });

    return app;
}
