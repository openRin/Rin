import { eq } from "drizzle-orm";
import { Elysia, t } from "elysia";
import { oauth2 } from "elysia-oauth2";
import type { DB } from "./context";
import { users } from "./db/schema";
import jwt from "./utils/jwt";
import { CacheImpl } from "./utils/cache";
import { drizzle } from "drizzle-orm/d1";
import * as schema from './db/schema';


const anyUser = async (db: DB) => (await db.query.users.findMany())?.length > 0

// Store type definition
export interface AppStore {
    db: DB;
    env: Env;
    cache: CacheImpl;
    serverConfig: CacheImpl;
    clientConfig: CacheImpl;
    anyUser: typeof anyUser;
}

export function createSetupPlugin(env: Env) {

    const db = drizzle(env.DB, { schema: schema })

    // Create cache instances
    const cache = new CacheImpl(db, env, "cache");
    const serverConfig = new CacheImpl(db, env, "server.config");
    const clientConfig = new CacheImpl(db, env, "client.config");
    let gh_client_id = env.RIN_GITHUB_CLIENT_ID;
    let gh_client_secret = env.RIN_GITHUB_CLIENT_SECRET;
    let jwt_secret = env.JWT_SECRET;

    if (!gh_client_id || !gh_client_secret) {
        throw new Error('Please set RIN_GITHUB_CLIENT_ID and RIN_GITHUB_CLIENT_SECRET');
    }
    if (!jwt_secret) {
        throw new Error('Please set JWT_SECRET');
    }

    const oauth = oauth2({
        GitHub: [
            gh_client_id,
            gh_client_secret,
            null
        ],
    });

    return new Elysia()
        .state('db', db)
        .state('env', env)
        .state('cache', cache)
        .state('serverConfig', serverConfig)
        .state('clientConfig', clientConfig)
        .state('anyUser', anyUser)
        .use(oauth)
        .use(
            jwt({
                aot: false,
                name: 'jwt',
                secret: jwt_secret,
                schema: t.Object({
                    id: t.Integer(),
                })
            })
        )
        .derive({ as: 'global' }, async ({ headers, jwt, store: { db }, oauth2 }) => {
            const authorization = headers['authorization']
            if (!authorization) {
                return {};
            }
            const token = authorization.split(' ')[1]
            const profile = await jwt.verify(token)
            if (!profile) {
                return {};
            }

            const user = await db.query.users.findFirst({ where: eq(users.id, profile.id) })
            if (!user) {
                return {};
            }
            return {
                uid: user.id,
                username: user.username,
                admin: user.permission === 1,
                oauth2: oauth2
            }
        })
}
