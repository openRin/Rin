import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { AUTH_ERROR_CODES, loginSchema, validateSchema, type AuthStatusResponse } from "@rin/api";
import type { AppContext, Variables } from "../core/hono-types";
import { profileAsync } from "../core/server-timing";
import { setJWTCookie, clearJWTCookie } from "../core/hono-middleware";
import { users } from "../db/schema";
import {
    BadRequestError,
    ForbiddenError,
    InternalServerError,
    bizError,
    validationErrorFromIssues,
} from "../errors";
import { hashPassword, checkRegistrationAvailable } from "./registration";
export function PasswordAuthService(): Hono<{
        Bindings: Env;
        Variables: Variables;
    }> {
    const app = new Hono<{
        Bindings: Env;
        Variables: Variables;
    }>();
    // Login with username and password
    app.post("/login", async (c: AppContext) => {
        const jwt = c.get('jwt');
        const db = c.get('db');
        const env = c.env;

        // Check if admin credentials are configured
        const adminUsername = env.ADMIN_USERNAME;
        const adminPassword = env.ADMIN_PASSWORD;

        if (!adminUsername || !adminPassword) {
            throw new BadRequestError('Admin credentials not configured');
        }

        const rawBody = await profileAsync(c, 'auth_login_parse', () => c.req.json());

        // 契约校验：与注册、评论共用 @rin/api 的 schema
        const validation = validateSchema<{ username: string; password: string }>(loginSchema, rawBody);
        if (!validation.success) {
            throw validationErrorFromIssues(
                AUTH_ERROR_CODES.AUTH_CREDENTIALS_REQUIRED,
                'Username and password are required',
                validation.issues,
            );
        }

        const { username, password } = validation.data;

        // Hash the provided password
        const hashedPassword = await profileAsync(c, 'auth_login_hash', () => hashPassword(password));

        // Check if this is the admin login
        if (username === adminUsername) {
            const expectedHash = await profileAsync(c, 'auth_admin_hash', () => hashPassword(adminPassword));
            
            if (hashedPassword !== expectedHash) {
                throw bizError(AUTH_ERROR_CODES.AUTH_INVALID_CREDENTIALS, 'Invalid credentials', 403);
            }

            // Find or create admin user
            let user = await profileAsync(c, 'auth_admin_lookup', () => db.query.users.findFirst({ 
                where: eq(users.openid, "admin") 
            }));

            if (!user) {
                // Create admin user if not exists
                const result = await profileAsync(c, 'auth_admin_insert', () => db.insert(users).values({
                    username: adminUsername,
                    openid: "admin",
                    avatar: "",
                    permission: 1,
                    password: expectedHash,
                }).returning({ insertedId: users.id }));

                if (!result || result.length === 0) {
                    throw new InternalServerError('Failed to create admin user');
                }

                user = await profileAsync(c, 'auth_admin_reload', () => db.query.users.findFirst({ 
                    where: eq(users.id, result[0].insertedId) 
                }));
            }

            if (!user) {
                throw new InternalServerError('Failed to get admin user');
            }

            if (user.password !== expectedHash) {
                // Update admin password if changed
                await profileAsync(c, 'auth_admin_sync', () => db.update(users)
                    .set({ password: expectedHash, username: adminUsername })
                    .where(eq(users.id, user.id)));
            }

            // Generate JWT token
            const token = await profileAsync(c, 'auth_admin_token', () => jwt.sign({ id: user.id }));

            // Set JWT cookie using Hono helper
            setJWTCookie(c, token);

            return c.json({
                success: true,
                token: token,
                user: {
                    id: user.id,
                    username: user.username,
                    avatar: user.avatar,
                    permission: user.permission === 1,
                }
            });
        }

        // Regular user login (if we want to support multiple users with passwords in the future)
        const user = await profileAsync(c, 'auth_user_lookup', () => db.query.users.findFirst({ 
            where: eq(users.username, username) 
        }));

        if (!user || !user.password) {
            throw bizError(AUTH_ERROR_CODES.AUTH_INVALID_CREDENTIALS, 'Invalid credentials', 403);
        }

        if (user.password !== hashedPassword) {
            throw bizError(AUTH_ERROR_CODES.AUTH_INVALID_CREDENTIALS, 'Invalid credentials', 403);
        }

        // Generate JWT token
        const token = await profileAsync(c, 'auth_user_token', () => jwt.sign({ id: user.id }));

        // Set JWT cookie using Hono helper
        setJWTCookie(c, token);

        return c.json({
            success: true,
            token: token,
            user: {
                id: user.id,
                username: user.username,
                avatar: user.avatar,
                permission: user.permission === 1,
            }
        });
    });

    // Check which login methods are available
    app.get("/status", async (c: AppContext) => {
        const env = c.env;
        const serverConfig = c.get('serverConfig');

        // 邮箱注册可用性由 SMTP 配置完整性决定，前端据此决定是否展示注册入口
        const register = await profileAsync(c, 'auth_status_register', () =>
            checkRegistrationAvailable(serverConfig, env),
        );

        const response: AuthStatusResponse = {
            github: !!(env.RIN_GITHUB_CLIENT_ID && env.RIN_GITHUB_CLIENT_SECRET),
            password: !!(env.ADMIN_USERNAME && env.ADMIN_PASSWORD),
            register,
        };

        return c.json(response);
    });

    return app;
}
