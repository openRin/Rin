import { eq } from "drizzle-orm";
import Elysia from "elysia";
import db from "../db/db";
import { users } from "../db/schema";
import { setup } from "../setup";
import { logger } from "../utils";
export const UserService = new Elysia()
    .use(setup)
    .group('/user', (group) =>
        group
            .get("/github", ({ oauth2 }) => oauth2.redirect("GitHub", { scopes: ["read:user"] }))
            .get("/github/callback", async ({ jwt, oauth2, redirect, cookie: { token } }) => {
                const gh_token = await oauth2.authorize("GitHub");
                // request https://api.github.com/user for user info
                const response = await fetch("https://api.github.com/user", {
                    headers: {
                        Authorization: `Bearer ${gh_token.accessToken}`,
                        Accept: "application/json",
                    },
                });
                const user = await response.json();
                const profile = {
                    openid: user.id,
                    username: user.name,
                    avatar: user.avatar_url,
                };
                await db.query.users.findFirst({ where: eq(users.openid, profile.openid) })
                    .then(async (user) => {
                        if (user) {
                            await db.update(users).set(profile).where(eq(users.id, user.id));
                            token.set({
                                value: await jwt.sign({ id: user.id }),
                                expires: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
                                path: '/',
                            })
                        } else {
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
                return redirect('/user/profile');
            })
            .get('/profile', async ({ jwt, set, cookie: { token } }) => {
                const profile = await jwt.verify(token.value)

                if (!profile) {
                    set.status = 401
                    return 'Unauthorized'
                }

                const user = await db.query.users.findFirst({ where: eq(users.id, profile.id) })
                if (!user) {
                    set.status = 404
                    return 'User not found'
                }
                return {
                    id: user.id,
                    username: user.username,
                    avatar: user.avatar,
                    createdAt: user.createdAt,
                    updatedAt: user.updatedAt,
                }
            })
    )

