import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { startTime, endTime } from "hono/timing";
import type { AppContext } from "../core/hono-types";
import { setJWTCookie } from "../core/hono-middleware";
import { users } from "../db/schema";
import {
    BadRequestError,
    ForbiddenError,
    InternalServerError,
    NotFoundError
} from "../errors";

export function UserService(): Hono {
    const app = new Hono();

    // GET /user/github - Redirect to GitHub OAuth
    app.get("/github", async (c: AppContext) => {
        startTime(c, 'user-github-redirect');
        const oauth2 = c.get('oauth2');

        if (!oauth2) {
            endTime(c, 'user-github-redirect');
            throw new BadRequestError('GitHub OAuth is not configured');
        }

        const referer = c.req.header('referer');

        if (!referer) {
            endTime(c, 'user-github-redirect');
            throw new BadRequestError('Referer header is required');
        }

        // Build callback URL from referer
        const refererUrl = new URL(referer);
        const callbackUrl = new URL('/callback', refererUrl.origin);

        setCookie(c, 'redirect_to', callbackUrl.toString(), {
            path: '/',
        });

        const genState = oauth2.generateState();
        setCookie(c, 'state', genState, {
            path: '/',
        });

        endTime(c, 'user-github-redirect');
        return c.redirect(oauth2.createRedirectUrl(genState, "GitHub"), 302);
    });

    // GET /user/github/callback - GitHub OAuth callback
    app.get("/github/callback", async (c: AppContext) => {
        startTime(c, 'user-github-callback');
        const oauth2 = c.get('oauth2');
        const jwt = c.get('jwt');
        const db = c.get('db');

        if (!oauth2) {
            endTime(c, 'user-github-callback');
            throw new BadRequestError('GitHub OAuth is not configured');
        }

        const query = c.req.query();
        const stateCookie = getCookie(c, 'state');

        console.log('param_state', query.state);
        console.log('cookie_state', stateCookie);

        // Verify state to prevent CSRF attacks
        if (query.state !== stateCookie) {
            endTime(c, 'user-github-callback');
            throw new BadRequestError('Invalid state parameter');
        }

        // Clear state cookie
        deleteCookie(c, 'state');

        // Exchange code for access token
        startTime(c, 'oauth2-authorize');
        const gh_token = await oauth2.authorize("GitHub", query.code);
        endTime(c, 'oauth2-authorize');
        if (!gh_token) {
            endTime(c, 'user-github-callback');
            throw new BadRequestError('Failed to authorize with GitHub');
        }

        // Request https://api.github.com/user for user info
        startTime(c, 'github-api-fetch');
        const response = await fetch("https://api.github.com/user", {
            headers: {
                Authorization: `Bearer ${gh_token.accessToken}`,
                Accept: "application/json",
                "User-Agent": "rin"
            },
        });
        endTime(c, 'github-api-fetch');

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

        // Check if user exists
        startTime(c, 'db-user-query');
        const existingUser = await db.query.users.findFirst({
            where: eq(users.openid, profile.openid)
        });
        endTime(c, 'db-user-query');

        if (existingUser) {
            profile.permission = existingUser.permission;
            startTime(c, 'db-user-update');
            await db.update(users).set(profile).where(eq(users.id, existingUser.id));
            endTime(c, 'db-user-update');
            startTime(c, 'jwt-sign');
            authToken = await jwt.sign({ id: existingUser.id });
            endTime(c, 'jwt-sign');
            setJWTCookie(c, authToken);
            // Store token in cookie for frontend to read (not HttpOnly)
            setCookie(c, 'auth_token', authToken, {
                expires: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
                path: '/',
                sameSite: 'Lax',
            });
        } else {
            // If no user exists, check if this is the first user
            startTime(c, 'db-any-user-check');
            const anyUserCheck = await db.query.users.findMany({ limit: 1 });
            endTime(c, 'db-any-user-check');
            if (anyUserCheck.length === 0) {
                profile.permission = 1;
            }

            startTime(c, 'db-user-insert');
            const result = await db.insert(users).values(profile).returning({ insertedId: users.id });
            endTime(c, 'db-user-insert');
            if (!result || result.length === 0) {
                endTime(c, 'user-github-callback');
                throw new InternalServerError('Failed to register user');
            }

            startTime(c, 'jwt-sign');
            authToken = await jwt.sign({ id: result[0].insertedId });
            endTime(c, 'jwt-sign');
            setJWTCookie(c, authToken);
            // Store token in cookie for frontend to read (not HttpOnly)
            setCookie(c, 'auth_token', authToken, {
                expires: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
                path: '/',
                sameSite: 'Lax',
            });
        }

        const redirectTo = getCookie(c, 'redirect_to');
        const redirect_url = new URL(redirectTo || '/');
        // Add token to URL for frontend to store (for cross-domain auth)
        if (authToken) {
            redirect_url.searchParams.set('token', authToken);
        }
        endTime(c, 'user-github-callback');
        return c.redirect(redirect_url.toString(), 302);
    });

    // GET /user/profile - Get user profile
    app.get('/profile', async (c: AppContext) => {
        startTime(c, 'user-profile');
        const uid = c.get('uid');
        const db = c.get('db');

        if (!uid) {
            endTime(c, 'user-profile');
            throw new ForbiddenError('Authentication required');
        }

        startTime(c, 'db-query');
        const user = await db.query.users.findFirst({ where: eq(users.id, uid) });
        endTime(c, 'db-query');
        if (!user) {
            endTime(c, 'user-profile');
            throw new NotFoundError('User');
        }

        endTime(c, 'user-profile');
        return c.json({
            id: user.id,
            username: user.username,
            avatar: user.avatar,
            permission: user.permission === 1,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
        });
    });

    // POST /user/logout - Logout user
    app.post('/logout', async (c: AppContext) => {
        startTime(c, 'user-logout');
        deleteCookie(c, 'token', {
            path: '/',
            httpOnly: true,
            secure: true,
            sameSite: 'Lax',
        });
        deleteCookie(c, 'auth_token', {
            path: '/',
            sameSite: 'Lax',
        });
        endTime(c, 'user-logout');
        return c.json({ success: true });
    });

    // PUT /user/profile - Update user profile
    app.put('/profile', async (c: AppContext) => {
        startTime(c, 'user-profile-update');
        const uid = c.get('uid');
        const db = c.get('db');
        const body = await c.req.json();

        if (!uid) {
            endTime(c, 'user-profile-update');
            throw new ForbiddenError('Authentication required');
        }

        const { username, avatar } = body as { username?: string; avatar?: string };

        if (!username && !avatar) {
            endTime(c, 'user-profile-update');
            throw new BadRequestError('At least one field (username or avatar) is required');
        }

        const updateData: { username?: string; avatar?: string } = {};
        if (username) updateData.username = username;
        if (avatar) updateData.avatar = avatar;

        startTime(c, 'db-update');
        await db.update(users).set(updateData).where(eq(users.id, uid));
        endTime(c, 'db-update');

        endTime(c, 'user-profile-update');
        return c.json({ success: true });
    });

    return app;
}
