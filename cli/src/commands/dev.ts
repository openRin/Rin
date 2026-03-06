import type { Subprocess } from "bun";
import { parseArgs } from "node:util";
import { logger } from "../lib/logger";
import { checkPort } from "../lib/network";
import { getWranglerEnv } from "../lib/wrangler";
import { runLocalDbMigrate } from "../tasks/db-migrate-local";
import { runSetupDev } from "../tasks/setup-dev";

const bunExec = process.execPath;

function registerSignalHandlers(processes: Subprocess[]) {
  const stopAll = () => {
    for (const child of processes) {
      child.kill("SIGTERM");
    }
  };

  process.on("SIGINT", stopAll);
  process.on("SIGTERM", stopAll);
}

function createViteArgs(port: number) {
  return [bunExec, "x", "vite", "--host", "0.0.0.0", "--port", String(port), "--strictPort"];
}

function createWranglerArgs(port: number) {
  return [bunExec, "x", "wrangler", "dev", "--port", String(port), "--test-scheduled"];
}

function createViteEnv(serverPort?: number) {
  return {
    ...process.env,
    RIN_VITE_CACHE_DIR: `/tmp/rin-vite-cache-${serverPort ?? "client"}`,
    ...(serverPort ? { RIN_SERVER_PORT: String(serverPort) } : {}),
  };
}

export async function runDevCommand(args: string[]) {
  const { values } = parseArgs({
    args,
    options: {
      port: { type: "string", short: "p", default: "11498" },
      client: { type: "boolean", default: false },
      server: { type: "boolean", default: false },
    },
    strict: false,
  });

  const port = parseInt((values.port as string) || "11498");
  if (!(await checkPort(port))) {
    throw new Error(`Port ${port} is already in use`);
  }

  const workerPort = port + 1;
  if (!values.client && !values.server && !(await checkPort(workerPort))) {
    throw new Error(`Internal worker port ${workerPort} is already in use`);
  }

  await runSetupDev();

  if (!values.client) {
    logger.info("Checking database migrations...");
    await runLocalDbMigrate();
    logger.success("Database migrations completed");
  }

  if (values.client) {
    const proc = Bun.spawn(createViteArgs(port), {
      stdout: "inherit",
      stderr: "inherit",
      cwd: "client",
      env: createViteEnv(),
    });
    registerSignalHandlers([proc]);
    await proc.exited;
    return;
  }

  if (values.server) {
    const proc = Bun.spawn(createWranglerArgs(port), {
      stdout: "inherit",
      stderr: "inherit",
      cwd: "server",
      env: getWranglerEnv(),
    });
    registerSignalHandlers([proc]);
    await proc.exited;
    return;
  }

  logger.info(`Starting worker on internal port ${workerPort}...`);
  const workerProc = Bun.spawn(createWranglerArgs(workerPort), {
    stdout: "inherit",
    stderr: "inherit",
    cwd: "server",
    env: getWranglerEnv(),
  });

  logger.info(`Starting Vite dev server with HMR on port ${port}...`);
  const clientProc = Bun.spawn(createViteArgs(port), {
    stdout: "inherit",
    stderr: "inherit",
    cwd: "client",
    env: createViteEnv(workerPort),
  });

  logger.success(`Development entry is http://localhost:${port} (API proxied to ${workerPort})`);
  registerSignalHandlers([workerProc, clientProc]);

  const exitCode = await Promise.race([workerProc.exited, clientProc.exited]);
  workerProc.kill("SIGTERM");
  clientProc.kill("SIGTERM");
  if (exitCode !== 0) {
    throw new Error("Development server exited unexpectedly");
  }
}
