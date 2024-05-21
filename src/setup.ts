import jwt from "@elysiajs/jwt";
import { eq } from "drizzle-orm";
import Elysia, { t } from "elysia";
import { oauth2 } from "elysia-oauth2";
import { users } from "./db/schema";
import db from "./db/db";
const gh_client_id = process.env.GITHUB_CLIENT_ID;
const gh_client_secret = process.env.GITHUB_CLIENT_SECRET;
const jwt_secret = process.env.JWT_SECRET;
if (!gh_client_id || !gh_client_secret) {
    throw new Error('Please set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET');
}
if (!jwt_secret) {
    throw new Error('Please set JWT_SECRET');
}
export const setup = new Elysia({ name: 'setup' })
    .use(
        jwt({
            name: 'jwt',
            secret: jwt_secret,
            schema: t.Object({
                id: t.Integer(),
            })
        })
    )
    .use(
        oauth2({
            GitHub: [
                gh_client_id,
                gh_client_secret
            ],
        })
    )
    .derive({ as: 'global' }, async ({ jwt, cookie: { token } }) => {
        if (process.env.NODE_ENV?.toLowerCase() === 'test') {
            console.log('Test mode')
            return {
                uid: 1,
                admin: true,
            }
        }
        const profile = await jwt.verify(token.value)
        console.log(profile)

        if (!profile) {
            return {};
        }

        const user = await db.query.users.findFirst({ where: eq(users.id, profile.id) })
        if (!user) {
            return {};
        }
        return {
            uid: user.id,
            admin: user.permission === 1,
        }
    })