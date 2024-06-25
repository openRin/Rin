import Elysia, { t } from "elysia";
import { setup } from "../setup";
import { ClientConfig, ServerConfig } from "../utils/cache";

export function ConfigService() {
    return new Elysia({ aot: false })
        .use(setup())
        .group('/config', (group) =>
            group
                .get('/:type', async ({ admin, params: { type } }) => {
                    if (type !== 'server' && type !== 'client') {
                        return 'Invalid type';
                    }
                    if (type === 'server' && !admin) {
                        return 'Unauthorized';
                    }
                    const config = type === 'server' ? ServerConfig() : ClientConfig();
                    return Object.fromEntries(config.all());
                })
                .post('/:type', async ({ admin, body, params: { type } }) => {
                    if (type !== 'server' && type !== 'client') {
                        return 'Invalid type';
                    }
                    if (!admin) {
                        return 'Unauthorized';
                    }
                    const config = type === 'server' ? ServerConfig() : ClientConfig();
                    for (const key in body) {
                        config.set(key, body[key], false);
                    }
                    await config.save();
                    return 'OK';
                }, {
                    body: t.Record(t.String(), t.Any())
                })
        )
}