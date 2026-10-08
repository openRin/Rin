import { logger } from "./lib/logger";
import { runDbCommand } from "./commands/db";
import { runDeployCommand } from "./commands/deploy";
import { runPublishCommand } from "./commands/publish";
import { runConfigCommand } from "./commands/config";
import { runDevCommand } from "./commands/dev";
import { runReleaseCommand } from "./commands/release";
import { runSetupDev } from "./tasks/setup-dev";
import { runSeoRender } from "./tasks/seo-render";

function printHelp() {
  console.log(`Rin CLI

Commands:
  dev
  deploy
  publish <payload.json> [--real] [--id <id>]
  config
  db migrate
  db fix-top-field
  setup-dev
  release <version>
  seo-render
`);
}

/**
 * 这些命令有自己的详细 help（参数多，总览里放不下）。
 * 调用 `<cmd> --help` 时转交给它们，而不是打印总览。
 */
const COMMANDS_WITH_OWN_HELP = new Set(["publish", "config"]);

export async function runCli(rawArgs: string[]) {
  const args = [...rawArgs];
  const commandIndex = args.findIndex((arg) => !arg.startsWith("-"));
  const command = commandIndex >= 0 ? args[commandIndex] : null;
  const cmdArgs = commandIndex >= 0 ? [...args.slice(0, commandIndex), ...args.slice(commandIndex + 1)] : args;

  if (!command || args.includes("-h") || args.includes("--help")) {
    // 已知命令的 `-h` 交给对应命令自己处理，这样能显示详细参数说明。
    if (command && COMMANDS_WITH_OWN_HELP.has(command)) {
      switch (command) {
        case "publish":
          await runPublishCommand(cmdArgs);
          return;
        case "config":
          await runConfigCommand(cmdArgs);
          return;
        default:
          break;
      }
    }

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
    case "publish":
      await runPublishCommand(cmdArgs);
      return;
    case "config":
      await runConfigCommand(cmdArgs);
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
