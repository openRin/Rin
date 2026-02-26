import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { startTime, endTime } from "hono/timing";
import type { AppContext, Variables } from "../core/hono-types";
import { setJWTCookie, clearJWTCookie } from "../core/hono-middleware";
import { users } from "../db/schema";
import {
    BadRequestError,
    ForbiddenError,
    InternalServerError,
} from "../errors";

// Hash password using SHA-256
async function hashPassword(password: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

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
        startTime(c, 'auth-login');
        const jwt = c.get('jwt');
        const db = c.get('db');
        const env = c.env;

        // Check if admin credentials are configured
        const adminUsername = env.ADMIN_USERNAME;
        const adminPassword = env.ADMIN_PASSWORD;

        if (!adminUsername || !adminPassword) {
            endTime(c, 'auth-login');
            throw new BadRequestError('Admin credentials not configured');
        }

        const { username, password } = await c.req.json() as { username: string; password: string };

        if (!username || !password) {
            endTime(c, 'auth-login');
            throw new BadRequestError('Username and password are required');
        }

        // Hash the provided password
        startTime(c, 'password-hash');
        const hashedPassword = await hashPassword(password);
        endTime(c, 'password-hash');

        // Check if this is the admin login
        if (username === adminUsername) {
            startTime(c, 'password-hash-admin');
            const expectedHash = await hashPassword(adminPassword);
            endTime(c, 'password-hash-admin');
            
            if (hashedPassword !== expectedHash) {
                endTime(c, 'auth-login');
                throw new ForbiddenError('Invalid credentials');
            }

            // Find or create admin user
            startTime(c, 'db-admin-query');
            let user = await db.query.users.findFirst({ 
                where: eq(users.openid, "admin") 
            });
            endTime(c, 'db-admin-query');

            if (!user) {
                // Create admin user if not exists
                startTime(c, 'db-admin-insert');
                const result = await db.insert(users).values({
                    username: adminUsername,
                    openid: "admin",
                    avatar: "",
                    permission: 1,
                    password: expectedHash,
                }).returning({ insertedId: users.id });
                endTime(c, 'db-admin-insert');

                if (!result || result.length === 0) {
                    endTime(c, 'auth-login');
                    throw new InternalServerError('Failed to create admin user');
                }

                startTime(c, 'db-admin-query-2');
                user = await db.query.users.findFirst({ 
                    where: eq(users.id, result[0].insertedId) 
                });
                endTime(c, 'db-admin-query-2');
            } else {
                // Update admin password if changed
                if (user.password !== expectedHash) {
                    startTime(c, 'db-admin-update');
                    await db.update(users)
                        .set({ password: expectedHash, username: adminUsername })
                        .where(eq(users.id, user.id));
                    endTime(c, 'db-admin-update');
                }
            }

            if (!user) {
                endTime(c, 'auth-login');
                throw new InternalServerError('Failed to get admin user');
            }

            // Generate JWT token
            startTime(c, 'jwt-sign');
            const token = await jwt.sign({ id: user.id });
            endTime(c, 'jwt-sign');

            // Set JWT cookie using Hono helper
            setJWTCookie(c, token);
            endTime(c, 'auth-login');

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
        startTime(c, 'db-user-query');
        const user = await db.query.users.findFirst({ 
            where: eq(users.username, username) 
        });
        endTime(c, 'db-user-query');

        if (!user || !user.password) {
            endTime(c, 'auth-login');
            throw new ForbiddenError('Invalid credentials');
        }

        if (user.password !== hashedPassword) {
            endTime(c, 'auth-login');
            throw new ForbiddenError('Invalid credentials');
        }

        // Generate JWT token
        startTime(c, 'jwt-sign');
        const token = await jwt.sign({ id: user.id });
        endTime(c, 'jwt-sign');

        // Set JWT cookie using Hono helper
        setJWTCookie(c, token);
        endTime(c, 'auth-login');

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

    // Check if password login is available
    app.get("/status", async (c: AppContext) => {
        startTime(c, 'auth-status');
        const env = c.env;
        endTime(c, 'auth-status');
        return c.json({
            github: !!(env.RIN_GITHUB_CLIENT_ID && env.RIN_GITHUB_CLIENT_SECRET),
            password: !!(env.ADMIN_USERNAME && env.ADMIN_PASSWORD),
        });
    });

    return app;
}
