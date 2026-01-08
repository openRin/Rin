import { eq } from "drizzle-orm";
import Elysia, { t } from "elysia";
import { oauth2 } from "elysia-oauth2";
import type { DB } from "./_worker";
import type { Env } from "./db/db";
import { users } from "./db/schema";
import { getDB, getEnv } from "./utils/di";
import jwt from "./utils/jwt";


const anyUser = async (db: DB) => (await db.query.users.findMany())?.length > 0
export function setup() {
    const db: DB = getDB();
    const env: Env = getEnv();
    let gh_client_id = env.RIN_GITHUB_CLIENT_ID || env.GITHUB_CLIENT_ID;
    let gh_client_secret = env.RIN_GITHUB_CLIENT_SECRET || env.GITHUB_CLIENT_SECRET;
    let jwt_secret = env.JWT_SECRET;

    // For development purposes, use dummy values if environment variables are not set
    if (!gh_client_id || !gh_client_secret) {
        console.warn('Warning: RIN_GITHUB_CLIENT_ID and RIN_GITHUB_CLIENT_SECRET not set. Using dummy values for development.');
        gh_client_id = 'dummy_client_id';
        gh_client_secret = 'dummy_client_secret';
    }
    if (!jwt_secret) {
        console.warn('Warning: JWT_SECRET not set. Using dummy value for development.');
        jwt_secret = 'dummy_jwt_secret';
    }
    const oauth = oauth2({
        GitHub: [
            gh_client_id,
            gh_client_secret
        ],
    })
    return new Elysia({ aot: false, name: 'setup' })
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
        .derive({ as: 'global' }, async ({ headers, jwt }) => {
            const authorization = headers['authorization']
            if (!authorization) {
                return {};
            }
            const token = authorization.split(' ')[1]
            if (process.env.NODE_ENV?.toLowerCase() === 'test') {
                console.warn('Now in test mode, skip jwt verification.')
                try {
                    return JSON.parse(token);
                } catch (e) {
                    return {};
                }
            }
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
            }
        })
}