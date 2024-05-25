import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from 'drizzle-orm/bun-sqlite/migrator';

const start = new Date().getTime();
let db_path = process.env.DB_PATH ?? "sqlite.db"
let connection = new Database(db_path, { create: true });
let db = drizzle(connection);
await migrate(db, { migrationsFolder: './drizzle' });
await connection.close();

const end = new Date().getTime();
console.info(`Migration to ${db_path} took ${end - start}ms`);
