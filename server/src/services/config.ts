import { t } from "elysia";
import base from "../base";
import { getAIConfigForFrontend } from "../utils/db-config";


// Sensitive fields that should not be exposed to frontend
const SENSITIVE_FIELDS = ['ai_summary.api_key'];

function maskSensitiveFields(config: Map<string, any>): Record<string, any> {
    const result: Record<string, any> = {};
    for (const [key, value] of config) {
        if (SENSITIVE_FIELDS.includes(key) && value) {
            // Mask the value - show only that it's set
            result[key] = '••••••••';
        } else {
            result[key] = value;
        }
    }
    return result;
}

export const ConfigService = base()
    .group('/config', (group) =>
        group
            .get('/:type', async ({ set, admin, params: { type }, store: { db, serverConfig, clientConfig } }) => {
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
            })
            .post('/:type', async ({ set, admin, body, params: { type }, store: { serverConfig, clientConfig } }) => {
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
                body: t.Record(t.String(), t.Any())
            })
            .delete('/cache', async ({ set, admin, store: { cache } }) => {
                if (!admin) {
                    set.status = 401;
                    return 'Unauthorized';
                }
                await cache.clear();
                return 'OK';
            })
    )