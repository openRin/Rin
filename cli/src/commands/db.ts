import { parseArgs } from "node:util";
import { fixTopField } from "../lib/db-migration";
import { resolveDbName, runLocalDbMigrate } from "../tasks/db-migrate-local";

export async function runDbCommand(args: string[]) {
  const [subcommand] = args;
  const { values } = parseArgs({
    args: args.slice(1),
    options: {
      db: { type: "string" },
    },
    strict: false,
  });
  // 不设默认 "rin"：留空时回退到 .env.local 的 DB_NAME，
  // 否则配置了自定义 DB_NAME 的用户会查错库。
  const dbName = resolveDbName(values.db as string | undefined);

  if (subcommand === "migrate") {
    await runLocalDbMigrate(dbName);
    return;
  }

  if (subcommand === "fix-top-field") {
    await fixTopField("local", dbName);
    return;
  }

  console.log("Database commands:\n  rin db migrate\n  rin db fix-top-field");
}
