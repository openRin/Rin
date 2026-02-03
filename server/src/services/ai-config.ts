import { t } from "elysia";
import { getAIConfigForFrontend, setAIConfig } from "../utils/db-config";
import base from "../base";


/**
 * AI Configuration Service
 * Handles AI summary settings with database storage
 * API key is never exposed to frontend
 */
export const AIConfigService = () => base()
    .group('/ai-config', (group) =>
        group
            // Get AI configuration (with masked API key)
            .get('/', async ({ set, admin, store: { db } }) => {
                if (!admin) {
                    set.status = 401;
                    return { error: 'Unauthorized' };
                }
                return await getAIConfigForFrontend(db);
            })
            // Update AI configuration
            .post('/', async ({ set, admin, body, store: { db } }) => {
                if (!admin) {
                    set.status = 401;
                    return { error: 'Unauthorized' };
                }

                await setAIConfig(db, {
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
    )
    ;
