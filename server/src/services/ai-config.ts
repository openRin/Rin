import { Router } from "../core/router";
import { t } from "../core/index";
import type { Context } from "../core/types";
import { getAIConfigForFrontend, setAIConfig } from "../utils/db-config";

/**
 * AI Configuration Service
 * Handles AI summary settings with database storage
 * API key is never exposed to frontend
 */
export function AIConfigService(router: Router): void {
    router.group('/ai-config', (group) => {
        // Get AI configuration (with masked API key)
        group.get('/', async (ctx: Context) => {
            const { set, admin, store: { db } } = ctx;
            
            if (!admin) {
                set.status = 401;
                return { error: 'Unauthorized' };
            }
            
            return await getAIConfigForFrontend(db);
        });

        // Update AI configuration
        group.post('/', async (ctx: Context) => {
            const { set, admin, body, store: { db } } = ctx;
            
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
            type: 'object',
            properties: {
                enabled: { type: 'boolean', optional: true },
                provider: { type: 'string', optional: true },
                model: { type: 'string', optional: true },
                api_key: { type: 'string', optional: true },
                api_url: { type: 'string', optional: true }
            }
        });
    });
}
