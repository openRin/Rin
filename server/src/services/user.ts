import { eq } from "drizzle-orm";
import { Router } from "../core/router";
import type { Context } from "../core/types";
import { users } from "../db/schema";
import {
    BadRequestError,
    ForbiddenError,
    InternalServerError,
    NotFoundError
} from "../errors";

export function UserService(router: Router): void {
    router.group('/user', (group) => {
        group.get("/github", async (ctx: Context) => {
            const { oauth2, set, headers, cookie } = ctx;
            
            if (!oauth2) {
                throw new BadRequestError('GitHub OAuth is not configured');
            }
            
            const referer = headers['referer'];
            
            if (!referer) {
                throw new BadRequestError('Referer header is required');
            }
            
            // Build callback URL from referer
            const refererUrl = new URL(referer);
            const callbackUrl = new URL('/callback', refererUrl.origin);
            
            cookie.redirect_to.set({
                value: callbackUrl.toString(),
                path: '/'
            });
            
            const genState = oauth2.generateState();
            cookie.state.set({
                value: genState,
                path: '/'
            });
            
            set.headers.set('Location', oauth2.createRedirectUrl(genState, "GitHub"));
            set.status = 302;
            return '';
        });

        group.get("/github/callback", async (ctx: Context) => {
            const { jwt, oauth2, set, store, query, cookie } = ctx;
            
            if (!oauth2) {
                throw new BadRequestError('GitHub OAuth is not configured');
            }
            
            const { db, anyUser } = store;

            console.log('param_state', query.state);
            console.log('cookie_state', cookie.state.value);

            // Verify state to prevent CSRF attacks
            if (query.state != cookie.state.value) {
                throw new BadRequestError('Invalid state parameter');
            }
            
            // Clear state cookie
            cookie.state.set({ value: '', path: '/' });

            // Exchange code for access token
            const gh_token = await oauth2.authorize("GitHub", query.code);
            if (!gh_token) {
                throw new BadRequestError('Failed to authorize with GitHub');
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
            
            let authToken: string | undefined;
            
            await db.query.users.findFirst({ where: eq(users.openid, profile.openid) })
                .then(async (user: any) => {
                    if (user) {
                        profile.permission = user.permission;
                        await db.update(users).set(profile).where(eq(users.id, user.id));
                        authToken = await jwt!.sign({ id: user.id });
                        cookie.token.set({
                            value: authToken,
                            expires: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
                            path: '/',
                            httpOnly: true,
                            secure: true,
                            sameSite: 'lax',
                        });
                        // Store token in cookie for frontend to read (not HttpOnly)
                        cookie.auth_token.set({
                            value: authToken,
                            expires: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
                            path: '/',
                            sameSite: 'lax',
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
                            throw new InternalServerError('Failed to register user');
                        } else {
                        authToken = await jwt!.sign({ id: result[0].insertedId });
                        cookie.token.set({
                            value: authToken,
                            expires: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
                            path: '/',
                            httpOnly: true,
                            secure: true,
                            sameSite: 'lax',
                        });
                        // Store token in cookie for frontend to read (not HttpOnly)
                        cookie.auth_token.set({
                            value: authToken,
                            expires: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
                            path: '/',
                            sameSite: 'lax',
                        });
                        }
                    }
                });
                
            const redirect_url = new URL(cookie.redirect_to.value);
            // Add token to URL for frontend to store (for cross-domain auth)
            if (authToken) {
                redirect_url.searchParams.set('token', authToken);
            }
            set.headers.set('Location', redirect_url.toString());
            set.status = 302;
            return '';
        });

        group.get('/profile', async (ctx: Context) => {
            const { uid, store: { db } } = ctx;

            if (!uid) {
                throw new ForbiddenError('Authentication required');
            }

            const user = await db.query.users.findFirst({ where: eq(users.id, uid) });
            if (!user) {
                throw new NotFoundError('User');
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

        group.post('/logout', async (ctx: Context) => {
            const { cookie } = ctx;
            cookie.token.set({
                value: '',
                expires: new Date(0),
                path: '/',
                httpOnly: true,
                secure: true,
                sameSite: 'lax',
            });
            return { success: true };
        });

        group.put('/profile', async (ctx: Context) => {
            const { uid, store: { db }, body } = ctx;

            if (!uid) {
                throw new ForbiddenError('Authentication required');
            }

            const { username, avatar } = body as { username?: string; avatar?: string };

            if (!username && !avatar) {
                throw new BadRequestError('At least one field (username or avatar) is required');
            }

            const updateData: { username?: string; avatar?: string } = {};
            if (username) updateData.username = username;
            if (avatar) updateData.avatar = avatar;

            await db.update(users).set(updateData).where(eq(users.id, uid));

            return { success: true };
        });
    });
}
