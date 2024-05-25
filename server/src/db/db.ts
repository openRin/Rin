import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import * as schema from './schema';
const db_path = process.env.DB_PATH ?? 'sqlite.db';
import {} from '../../migrate'

const is_exists = await Bun.file(db_path).exists()
if (!is_exists) {
    console.log('Database not found, creating a new one...')
    const init_db = Bun.file("init.db");
    await Bun.write(db_path, init_db);
}
const connection = new Database(db_path);
export const db = drizzle(connection, { schema: schema });

export default db;