import Elysia, { t } from "elysia";
import { setup } from "../setup";
import { getAIConfigForFrontend, setAIConfig } from "../utils/db-config";

/**
 * AI Configuration Service
 * Handles AI summary settings with database storage
 * API key is never exposed to frontend
 */
export function AIConfigService() {
    return new Elysia({ aot: false })
        .use(setup())
        .group('/ai-config', (group) =>
            group
                // Get AI configuration (with masked API key)
                .get('/', async ({ set, admin }) => {
                    if (!admin) {
                        set.status = 401;
                        return { error: 'Unauthorized' };
                    }
                    return await getAIConfigForFrontend();
                })
                // Update AI configuration
                .post('/', async ({ set, admin, body }) => {
                    if (!admin) {
                        set.status = 401;
                        return { error: 'Unauthorized' };
                    }

                    await setAIConfig({
                        enabled: body.enabled,
                        provider: body.provider,
                        model: body.model,
                        api_key: body.api_key,
                        api_url: body.api_url,
                    });

                    return { success: true };
                }, {
                    body: t.Object({
                        enabled: t.Optional(t.Boolean()),
                        provider: t.Optional(t.String()),
                        model: t.Optional(t.String()),
                        api_key: t.Optional(t.String()),
                        api_url: t.Optional(t.String()),
                    })
                })
        );
}
