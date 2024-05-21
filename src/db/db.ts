import { Database } from "bun:sqlite";
import { drizzle, type BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import * as schema from './schema';

let dbInstance: BunSQLiteDatabase<typeof schema>;

const getDbInstance = () => {
    if (!dbInstance) {
        console.log(`Connect to ${process.env.DB_PATH}`);
        const connection = new Database(process.env.DB_PATH ?? 'sqlite.db', { create: true });
        dbInstance = drizzle(connection, { schema: schema });
    }
    return dbInstance;
}

export default getDbInstance();