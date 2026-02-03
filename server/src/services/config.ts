import { Router } from "../core/router";
import { t } from "../core/types";
import type { Context } from "../core/types";
import { getAIConfigForFrontend } from "../utils/db-config";

// Sensitive fields that should not be exposed to frontend
const SENSITIVE_FIELDS = ['ai_summary.api_key'];

function maskSensitiveFields(config: Map<string, any>): Record<string, any> {
    const result: Record<string, any> = {};
    for (const [key, value] of config) {
        if (SENSITIVE_FIELDS.includes(key) && value) {
            result[key] = '••••••••';
        } else {
            result[key] = value;
        }
    }
    return result;
}

export function ConfigService(router: Router): void {
    router.group('/config', (group) => {
        // GET /config/:type
        group.get('/:type', async (ctx: Context) => {
            const { set, admin, params, store: { db, serverConfig, clientConfig } } = ctx;
            const { type } = params;
            
            if (type !== 'server' && type !== 'client') {
                set.status = 400;
                return 'Invalid type';
            }
            
            if (type === 'server' && !admin) {
                set.status = 401;
                return 'Unauthorized';
            }
            
            const config = type === 'server' ? serverConfig : clientConfig;
            const all = await config.all();
            
            // Mask sensitive fields for server config
            if (type === 'server') {
                return maskSensitiveFields(all);
            }
            
            // For client config, include AI summary enabled status
            const clientConfigData = Object.fromEntries(all);
            const aiConfig = await getAIConfigForFrontend(db);
            return {
                ...clientConfigData,
                'ai_summary.enabled': aiConfig.enabled ?? false
            };
        });

        // POST /config/:type
        group.post('/:type', async (ctx: Context) => {
            const { set, admin, body, params, store: { serverConfig, clientConfig } } = ctx;
            const { type } = params;
            
            if (type !== 'server' && type !== 'client') {
                set.status = 400;
                return 'Invalid type';
            }
            
            if (!admin) {
                set.status = 401;
                return 'Unauthorized';
            }
            
            const config = type === 'server' ? serverConfig : clientConfig;
            for (const key in body) {
                await config.set(key, body[key], false);
            }
            await config.save();
            return 'OK';
        }, {
            type: 'object',
            additionalProperties: true
        });

        // DELETE /config/cache
        group.delete('/cache', async (ctx: Context) => {
            const { set, admin, store: { cache } } = ctx;
            
            if (!admin) {
                set.status = 401;
                return 'Unauthorized';
            }
            
            await cache.clear();
            return 'OK';
        });
    });
}
