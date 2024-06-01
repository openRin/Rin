import { drizzle } from 'drizzle-orm/d1';

export interface Env {
    DB: D1Database;
    GITHUB_CLIENT_ID: string;
    GITHUB_CLIENT_SECRET: string;
    JWT_SECRET: string;
    FRONTEND_URL: string;
}

export function db(env: Env) {
    return drizzle(env.DB);
}
export default db;