import { eq } from "drizzle-orm";
import { users } from "../db/schema";
import { Router } from "../core/router";
import { t } from "../core/types";
import type { Context } from "../core/types";

export function UserService(router: Router): void {
    router.group('/user', (group) => {
        group.get("/github", async (ctx: Context) => {
            const { oauth2, set, headers, cookie } = ctx;
            const referer = headers['referer'];
            
            if (!referer) {
                return 'Referer not found';
            }
            
            cookie.redirect_to.set({
                value: `${referer}`,
                path: '/'
            });
            
            const genState = oauth2!.generateState();
            cookie.state.set({
                value: genState,
                path: '/'
            });
            
            set.headers.set('Location', oauth2!.createRedirectUrl(genState, "GitHub"));
            set.status = 302;
            return '';
        });

        group.get("/github/callback", async (ctx: Context) => {
            const { jwt, oauth2, set, store, query, cookie } = ctx;
            const { db, anyUser } = store;

            console.log('param_state', query.state);
            console.log('cookie_state', cookie.state.value);

            // Verify state to prevent CSRF attacks
            if (query.state != cookie.state.value) {
                set.status = 400;
                return 'Invalid state parameter';
            }
            
            // Clear state cookie
            cookie.state.set({ value: '', path: '/' });

            // Exchange code for access token
            const gh_token = await oauth2!.authorize("GitHub", query.code);
            if (!gh_token) {
                set.status = 400;
                return 'Failed to authorize with GitHub';
            }
            
            // request https://api.github.com/user for user info
            const response = await fetch("https://api.github.com/user", {
                headers: {
                    Authorization: `Bearer ${gh_token.accessToken}`,
                    Accept: "application/json",
                    "User-Agent": "rin"
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
                .then(async (user: any) => {
                    if (user) {
                        profile.permission = user.permission;
                        await db.update(users).set(profile).where(eq(users.id, user.id));
                        cookie.token.set({
                            value: await jwt!.sign({ id: user.id }),
                            expires: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
                            path: '/',
                        });
                    } else {
                        // if no user exists, set permission to 1
                        if (!await anyUser(db)) {
                            const realTimeCheck = (await db.query.users.findMany())?.length > 0;
                            if (!realTimeCheck) {
                                profile.permission = 1;
                            }
                        }
                        const result = await db.insert(users).values(profile).returning({ insertedId: users.id });
                        if (!result || result.length === 0) {
                            throw new Error('Failed to register');
                        } else {
                            cookie.token.set({
                                value: await jwt!.sign({ id: result[0].insertedId }),
                                expires: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
                                path: '/',
                            });
                        }
                    }
                });
                
            const redirect_url = `${cookie.redirect_to.value}`;
            set.headers.set('Location', redirect_url);
            set.status = 302;
            return '';
        });

        group.get('/profile', async (ctx: Context) => {
            const { set, uid, store: { db } } = ctx;
            
            if (!uid) {
                set.status = 403;
                return 'Permission denied';
            }
            
            const user = await db.query.users.findFirst({ where: eq(users.id, uid) });
            if (!user) {
                set.status = 404;
                return 'User not found';
            }
            
            return {
                id: user.id,
                username: user.username,
                avatar: user.avatar,
                permission: user.permission === 1,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt,
            };
        });
    });
}
