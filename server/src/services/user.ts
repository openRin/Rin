import { eq } from "drizzle-orm";
import Elysia, { t } from "elysia";
import { URL } from "url";
import type { DB } from "../_worker";
import { users } from "../db/schema";
import { setup } from "../setup";
import { getDB } from "../utils/di";

export function UserService() {
    const db: DB = getDB();
    return new Elysia({ aot: false })
        .use(setup())
        .group('/user', (group) =>
            group
                .get("/github", ({ oauth2, headers: { referer }, cookie: { redirect_to } }) => {
                    if (!referer) {
                        return 'Referer not found'
                    }
                    const referer_url = new URL(referer)
                    redirect_to.value = `${referer_url.protocol}//${referer_url.host}`
                    return oauth2.redirect("GitHub", { scopes: ["read:user"] })
                })
                .get("/github/callback", async ({ jwt, oauth2, set, store, query, cookie: { token, redirect_to, state } }) => {

                    console.log('state', state.value)
                    console.log('p_state', query.state)

                    const gh_token = await oauth2.authorize("GitHub");
                    // request https://api.github.com/user for user info
                    const response = await fetch("https://api.github.com/user", {
                        headers: {
                            Authorization: `Bearer ${gh_token.accessToken}`,
                            Accept: "application/json",
                            "User-Agent": "elysia"
                        },
                    });
                    const user: any = await response.json();
                    const profile: {
                        openid: string;
                        username: string;
                        avatar: string;
                        permission: number | null;
                    } = {
                        openid: user.id,
                        username: user.name || user.login,
                        avatar: user.avatar_url,
                        permission: 0
                    };
                    await db.query.users.findFirst({ where: eq(users.openid, profile.openid) })
                        .then(async (user) => {
                            if (user) {
                                profile.permission = user.permission
                                await db.update(users).set(profile).where(eq(users.id, user.id));
                                token.set({
                                    value: await jwt.sign({ id: user.id }),
                                    expires: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
                                    path: '/',
                                })
                            } else {
                                // if no user exists, set permission to 1
                                // store.anyUser is a global state to cache the existence of any user
                                if (!await store.anyUser(db)) {
                                    const realTimeCheck = (await db.query.users.findMany())?.length > 0
                                    if (!realTimeCheck) {
                                        profile.permission = 1
                                        store.anyUser = async (_: DB) => true
                                    }
                                }
                                const result = await db.insert(users).values(profile).returning({ insertedId: users.id });
                                if (!result || result.length === 0) {
                                    throw new Error('Failed to register');
                                } else {
                                    token.set({
                                        value: await jwt.sign({ id: result[0].insertedId }),
                                        expires: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
                                        path: '/',
                                    })
                                }
                            }
                        });
                    const redirect_host = redirect_to.value || ""
                    const redirect_url = (`${redirect_host}/callback?token=${token.value}`);
                    set.headers = {
                        'Content-Type': 'text/html',
                    }
                    set.redirect = redirect_url
                }, {
                    query: t.Object({
                        state: t.String(),
                        code: t.String(),
                    })
                })
                .get('/profile', async ({ set, uid }) => {
                    if (!uid) {
                        set.status = 403
                        return 'Permission denied'
                    }
                    const uid_num = parseInt(uid)
                    const user = await db.query.users.findFirst({ where: eq(users.id, uid_num) })
                    if (!user) {
                        set.status = 404
                        return 'User not found'
                    }
                    return {
                        id: user.id,
                        username: user.username,
                        avatar: user.avatar,
                        permission: user.permission === 1,
                        createdAt: user.createdAt,
                        updatedAt: user.updatedAt,
                    }
                })
        )
}