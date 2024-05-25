import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from 'drizzle-orm/bun-sqlite/migrator';

const start = new Date().getTime();
const db_path = process.env.DB_PATH ?? "sqlite.db"
const connection = new Database(db_path, { create: true });
const db = drizzle(connection);
migrate(db, { migrationsFolder: './drizzle' });
connection.close();

const end = new Date().getTime();
console.info(`Migration to ${db_path} took ${end - start}ms`);
