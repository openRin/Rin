import { logger } from "./lib/logger";
import { runDbCommand } from "./commands/db";
import { runDeployCommand } from "./commands/deploy";
import { runDevCommand } from "./commands/dev";
import { runReleaseCommand } from "./commands/release";
import { runSetupDev } from "./tasks/setup-dev";
import { runSeoRender } from "./tasks/seo-render";

function printHelp() {
  console.log(`Rin CLI

Commands:
  dev
  deploy
  db migrate
  db fix-top-field
  setup-dev
  release <version>
  seo-render
`);
}

export async function runCli(rawArgs: string[]) {
  const args = [...rawArgs];
  const commandIndex = args.findIndex((arg) => !arg.startsWith("-"));
  const command = commandIndex >= 0 ? args[commandIndex] : null;
  const cmdArgs = commandIndex >= 0 ? [...args.slice(0, commandIndex), ...args.slice(commandIndex + 1)] : args;

  if (!command || args.includes("-h") || args.includes("--help")) {
    printHelp();
    return;
  }

  if (args.includes("-v") || args.includes("--version")) {
    console.log("rin-cli v1.0.0");
    return;
  }

  switch (command) {
    case "dev":
      await runDevCommand(cmdArgs);
      return;
    case "deploy":
      await runDeployCommand(cmdArgs);
      return;
    case "db":
      await runDbCommand(cmdArgs);
      return;
    case "release":
      await runReleaseCommand(cmdArgs);
      return;
    case "setup-dev":
      await runSetupDev();
      return;
    case "seo-render":
      await runSeoRender();
      return;
    default:
      logger.error(`Unknown command: ${command}`);
      printHelp();
      throw new Error(`Unknown command: ${command}`);
  }
}
