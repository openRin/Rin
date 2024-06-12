import * as fs from 'fs';
import * as path from 'path';
import {execSync} from 'child_process';

const DB_NAME = "rin";
const SQL_DIR = path.join(__dirname, '..', 'server', 'sql');

// Change to the server/sql directory
process.chdir(SQL_DIR);

// List all SQL files and sort them
const sqlFiles = fs
    .readdirSync(SQL_DIR, {withFileTypes: true})
    .filter(dirent => dirent.isFile() && dirent.name.endsWith('.sql'))
    .map(dirent => dirent.name)
    .sort();

// For each file in the sorted list
for (const file of sqlFiles) {
    const filePath = path.join(SQL_DIR, file);
    // Run the migration
    try {
        execSync(`bunx wrangler d1 execute ${DB_NAME} --local --file "${filePath}"`, {stdio: 'inherit'});
        console.log(`Executed ${file}`);
    } catch (error) {
        console.error(`Failed to execute ${file}: ${error}`);
        process.exit(1);
    }
}

// Back to the root directory (optional, as the script ends)
process.chdir(__dirname);