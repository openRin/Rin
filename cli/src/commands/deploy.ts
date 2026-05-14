import { parseArgs } from "node:util";
import { runCloudflareDeploy } from "../tasks/deploy-cf";

export async function runDeployCommand(args: string[]) {
  const { values } = parseArgs({
    args,
    options: {
      preview: { type: "boolean" },
      server: { type: "boolean" },
      client: { type: "boolean" },
    },
  });

  const target = values.server ? "server" : values.client ? "client" : "all";
  await runCloudflareDeploy(target, Boolean(values.preview));
}
