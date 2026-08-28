import { parseArgs } from "node:util";
import { fixTopField, isInfoExist } from "../lib/db-migration";
import { runLocalDbMigrate } from "../tasks/db-migrate-local";

export async function runDbCommand(args: string[]) {
  const [subcommand] = args;
  const { values } = parseArgs({
    args: args.slice(1),
    options: {
      db: { type: "string", default: "rin" },
    },
    strict: false,
  });
  const dbName = (values.db as string) || "rin";

  if (subcommand === "migrate") {
    await runLocalDbMigrate(dbName);
    return;
  }

  if (subcommand === "fix-top-field") {
    const infoExists = await isInfoExist("local", dbName);
    await fixTopField("local", dbName, infoExists);
    return;
  }

  console.log("Database commands:\n  rin db migrate\n  rin db fix-top-field");
}
