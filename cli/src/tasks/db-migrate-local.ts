import * as fs from "node:fs";
import * as path from "node:path";
import { execSync } from "node:child_process";
import { fixTopField, getMigrationFileVersion, getMigrationVersion, isInfoExist, updateMigrationVersion } from "../lib/db-migration";

export async function runLocalDbMigrate(dbName = "rin") {
  const sqlDir = path.join(process.cwd(), "server", "sql");

  const type = "local";
  const migrationVersion = await getMigrationVersion(type, dbName);
  const infoExists = await isInfoExist(type, dbName);
  const sqlFiles = fs
    .readdirSync(sqlDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
    .map((entry) => entry.name)
    .filter((file) => {
      const version = getMigrationFileVersion(file);
      return version !== null && version > migrationVersion;
    })
    .sort((left, right) => {
      return (getMigrationFileVersion(left) || 0) - (getMigrationFileVersion(right) || 0);
    });

  console.log("migration_version:", migrationVersion, "Migration SQL List: ", sqlFiles);

  for (const file of sqlFiles) {
    const filePath = path.join(sqlDir, file);
    try {
      execSync(`bunx wrangler d1 execute ${dbName} --local --file "${filePath}"`, { stdio: "inherit" });
      console.log(`Executed ${file}`);
    } catch (error) {
      console.error(`Failed to execute ${file}: ${error}`);
      process.exit(1);
    }
  }

  if (sqlFiles.length === 0) {
    console.log("No migration needed.");
  } else {
    const lastVersion = getMigrationFileVersion(sqlFiles[sqlFiles.length - 1] || "");
    if (lastVersion !== null && lastVersion > migrationVersion) {
      await updateMigrationVersion(type, dbName, lastVersion);
    }
  }

  await fixTopField(type, dbName, infoExists);
}
