import { eq } from "drizzle-orm";
import Elysia from "elysia";
import db from "../db/db";
import { users } from "../db/schema";
import { frontend_url, setup } from "../setup";
export const UserService = new Elysia()
    .use(setup)
    .group('/user', (group) =>
        group
            .get("/github", ({ oauth2 }) => oauth2.redirect("GitHub", { scopes: ["read:user"] }))
            .get("/github/callback", async ({ jwt, oauth2, redirect, store, cookie: { token } }) => {
                const gh_token = await oauth2.authorize("GitHub");
                // request https://api.github.com/user for user info
                const response = await fetch("https://api.github.com/user", {
                    headers: {
                        Authorization: `Bearer ${gh_token.accessToken}`,
                        Accept: "application/json",
                    },
                });
                const user = await response.json();
                const profile:{
                    openid: string;
                    username: string;
                    avatar: string;
                    permission: number | null;
                } = {
                    openid: user.id,
                    username: user.name,
                    avatar: user.avatar_url,
                    permission: null
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
                            if (!store.anyUser) {
                                const realTimeCheck = (await db.query.users.findMany())?.length > 0
                                if (!realTimeCheck) {
                                    profile.permission = 1
                                    store.anyUser = true
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
                return redirect(`${frontend_url}/callback?token=${token.value}`);
            })
            .get('/profile', async ({ jwt, set, uid }) => {
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

