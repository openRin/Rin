import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { fixTopField, getMigrationVersion, isInfoExist, updateMigrationVersion } from './fix-top-field';

const DB_NAME = "rin";
const SQL_DIR = path.join(__dirname, '..', 'server', 'sql');

// Change to the server/sql directory
process.chdir(SQL_DIR);
const typ = 'local';
const migrationVersion = await getMigrationVersion(typ, DB_NAME);
const isInfoExistResult = await isInfoExist(typ, DB_NAME);
// List all SQL files and sort them
const sqlFiles = fs
    .readdirSync(SQL_DIR, { withFileTypes: true })
    .filter(dirent => dirent.isFile() && dirent.name.endsWith('.sql'))
    .map(dirent => dirent.name)
    .filter(file => {
        const version = parseInt(file.split('-')[0]);
        return version > migrationVersion;
    })
    .sort();

console.log("migration_version:", migrationVersion, "Migration SQL List: ", sqlFiles)

// For each file in the sorted list
for (const file of sqlFiles) {
    const filePath = path.join(SQL_DIR, file);
    // Run the migration
    try {
        execSync(`bunx wrangler d1 execute ${DB_NAME} --local --file "${filePath}"`, { stdio: 'inherit' });
        console.log(`Executed ${file}`);
    } catch (error) {
        console.error(`Failed to execute ${file}: ${error}`);
        process.exit(1);
    }
}

if (sqlFiles.length === 0) {
    console.log("No migration needed.")
} else {
    const lastVersion = parseInt(sqlFiles[sqlFiles.length - 1].split('-')[0]);
    if (lastVersion > migrationVersion) {
        // Update the migration version
        await updateMigrationVersion(typ, DB_NAME, lastVersion);
    }
}

await fixTopField(typ, DB_NAME, isInfoExistResult);

// Back to the root directory (optional, as the script ends)
process.chdir(__dirname);