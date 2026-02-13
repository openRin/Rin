#!/usr/bin/env bun
/**
 * Rin CLI - Unified command line interface for Rin blog platform
 * 
 * Usage:
 *   rin dev                    Start unified development server on port 11498
 *   rin deploy                 Deploy to Cloudflare
 *   rin deploy --preview       Deploy to preview environment
 *   rin db migrate             Run database migrations
 *   rin release patch          Create a new release
 */

import { parseArgs } from "util";
import { $ } from "bun";
import { existsSync, readFileSync, readdirSync } from "fs";
import { join } from "path";
import * as net from "net";
import stripIndent from "strip-indent";

// Colors for terminal output
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
};

function log(label: string, message: string, color: string = colors.reset) {
  const timestamp = new Date().toLocaleTimeString("zh-CN", { hour12: false });
  console.log(`${colors.dim}[${timestamp}]${colors.reset} ${color}[${label}]${colors.reset} ${message}`);
}

const logger = {
  info: (msg: string) => log("INFO", msg, colors.blue),
  success: (msg: string) => log("SUCCESS", msg, colors.green),
  warn: (msg: string) => log("WARN", msg, colors.yellow),
  error: (msg: string) => log("ERROR", msg, colors.red),
};

// Utility functions
function parseEnv(content: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const equalIndex = trimmed.indexOf("=");
    if (equalIndex > 0) {
      env[trimmed.substring(0, equalIndex).trim()] = trimmed.substring(equalIndex + 1).trim();
    }
  }
  return env;
}

async function loadEnv(): Promise<Record<string, string>> {
  try {
    const file = Bun.file(".env.local");
    if (await file.exists()) {
      return parseEnv(await file.text());
    }
  } catch {}
  return {};
}

function checkPort(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", (err: any) => resolve(err.code !== "EADDRINUSE"));
    server.once("listening", () => {
      server.close();
      resolve(true);
    });
    server.listen(port);
  });
}

async function setupDevEnv() {
  const setupScript = join(process.cwd(), "scripts", "setup-dev.ts");
  if (existsSync(setupScript)) {
    logger.info("Setting up development environment...");
    const proc = Bun.spawn(["bun", setupScript], {
      stdout: "inherit",
      stderr: "inherit",
    });
    await proc.exited;
  }
}

// Commands
async function devCommand(args: string[]) {
  const { values } = parseArgs({
    args,
    options: {
      port: { type: "string", short: "p", default: "11498" },
      client: { type: "boolean", default: false },
      server: { type: "boolean", default: false },
    },
    strict: false,
  });

  const PORT = parseInt((values.port as string) || "11498");

  // Check port
  if (!(await checkPort(PORT))) {
    logger.error(`Port ${PORT} is already in use`);
    process.exit(1);
  }

  // Setup environment first
  await setupDevEnv();

  // Run database migrations for server modes
  if (!values.client) {
    logger.info("Checking database migrations...");
    const migrateScript = join(process.cwd(), "scripts", "db-migrate-local.ts");
    if (existsSync(migrateScript)) {
      const migrateProc = Bun.spawn(["bun", migrateScript], {
        stdout: "inherit",
        stderr: "inherit",
      });
      const migrateExit = await migrateProc.exited;
      if (migrateExit !== 0) {
        logger.error("Database migration failed");
        process.exit(1);
      }
      logger.success("Database migrations completed");
    }
  }

  // Client-only mode: Just run Vite dev server
  if (values.client) {
    logger.info(`Starting client development server...`);
    const proc = Bun.spawn(
      ["bun", "--filter", "./client", "dev"],
      {
        stdout: "inherit",
        stderr: "inherit",
      }
    );

    const shutdown = () => {
      logger.info("Shutting down client server...");
      proc.kill("SIGTERM");
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
    return;
  }

  // Server-only mode: Just run wrangler dev
  if (values.server) {
    logger.info(`Starting server development server on port ${PORT}...`);
    const proc = Bun.spawn(
      ["bun", "wrangler", "dev", "--port", String(PORT), "--test-scheduled"],
      {
        stdout: "inherit",
        stderr: "inherit",
        cwd: join(process.cwd(), "server"),
      }
    );

    const shutdown = () => {
      logger.info("Shutting down server...");
      proc.kill("SIGTERM");
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
    return;
  }

  // Unified mode: Build client and serve with wrangler dev
  logger.info(`Starting unified development server at http://localhost:${PORT}`);
  logger.info("This will serve both frontend and backend on the same port");

  // Build client first
  logger.info("Building client for development...");
  const buildProc = Bun.spawn(
    ["bun", "--filter", "./client", "build"],
    {
      stdout: "inherit",
      stderr: "inherit",
    }
  );
  
  const buildExit = await buildProc.exited;
  if (buildExit !== 0) {
    logger.error("Client build failed");
    process.exit(1);
  }
  logger.success("Client built successfully");

  // Start wrangler dev with assets
  logger.info("Starting wrangler dev server with static assets...");
  const proc = Bun.spawn(
    ["bun", "wrangler", "dev", "--port", String(PORT), "--test-scheduled"],
    {
      stdout: "inherit",
      stderr: "inherit",
      cwd: join(process.cwd(), "server"),
    }
  );

  // Handle shutdown
  const shutdown = () => {
    logger.info("Shutting down...");
    proc.kill("SIGTERM");
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

async function deployCommand(args: string[]) {
  const { values } = parseArgs({
    args,
    options: {
      preview: { type: "boolean" },
      server: { type: "boolean" },
      client: { type: "boolean" },
    },
  });

  const target = values.server ? "server" : values.client ? "client" : "all";
  
  logger.info(`Deploying ${target}...`);
  
  // Run the deploy script
  const deployScript = join(process.cwd(), "scripts", "deploy-cf.ts");
  if (existsSync(deployScript)) {
    await $`bun ${deployScript} ${target}`;
  } else {
    logger.error("Deploy script not found");
    process.exit(1);
  }
}

async function dbCommand(args: string[]) {
  const [subcommand] = args;

  if (subcommand === "migrate") {
    logger.info("Running database migration...");
    const migrateScript = join(process.cwd(), "scripts", "db-migrate-local.ts");
    if (existsSync(migrateScript)) {
      await $`bun ${migrateScript}`;
    } else {
      logger.error("Migration script not found");
      process.exit(1);
    }
  } else {
    console.log(`
Database commands:
  rin db migrate    Run database migrations
    `);
  }
}

async function releaseCommand(args: string[]) {
  const [version] = args;
  
  if (!version) {
    console.log(`
Usage: rin release <version>

Examples:
  rin release patch     Bump patch version
  rin release minor     Bump minor version
  rin release major     Bump major version
  rin release 1.2.3     Set specific version
    `);
    return;
  }

  logger.info(`Creating release: ${version}`);
  const releaseScript = join(process.cwd(), "scripts", "release.ts");
  if (existsSync(releaseScript)) {
    const versionArg = typeof version === "string" ? version : String(version);
    await $`bun ${releaseScript} ${versionArg}`;
  } else {
    logger.error("Release script not found");
    process.exit(1);
  }
}

// Main
async function main() {
  const args = Bun.argv.slice(2);
  const commandIndex = args.findIndex(arg => !arg.startsWith("-"));
  const command = commandIndex >= 0 ? args[commandIndex] : null;
  const cmdArgs = [...args.slice(0, commandIndex), ...args.slice(commandIndex + 1)];

  if (!command) {
    console.log("Usage: rin <command> [options]");
    console.log('Run "rin --help" for more information');
    process.exit(0);
  }

  // Handle global options
  if (args.includes("-h") || args.includes("--help")) {
    console.log(`
Rin CLI - Unified command line interface for Rin blog platform

Usage: rin <command> [options]

Commands:
  dev                          Start unified development server
    -p, --port <port>          Server port (default: 11498)
    --client                   Start client-only dev server (Vite + HMR)
    --server                   Start server-only dev server (wrangler)

  deploy                       Deploy to Cloudflare
    --preview                  Deploy to preview environment
    --server                   Deploy backend only
    --client                   Deploy frontend only

  db                           Database operations
    migrate                    Run database migrations

  release                      Create a new release
    <version>                  Version (patch/minor/major/x.y.z)

Options:
  -h, --help                   Show help
  -v, --version                Show version
  -d, --debug                  Enable debug mode

Examples:
  rin dev                      Start unified dev server at http://localhost:11498
  rin dev -p 3000              Use custom port
  rin dev --client             Start client-only dev server with HMR
  rin dev --server             Start server-only dev server
  rin deploy                   Deploy to production
  rin release patch            Bump patch version

Architecture:
  Unified dev server (rin dev):
    - Uses wrangler dev with ASSETS binding
    - Serves frontend static files and backend API on same port
    - Frontend built once at startup (no HMR)
    
  Client-only dev server (rin dev --client):
    - Uses Vite dev server with HMR
    - Separate backend server required
    
  Server-only dev server (rin dev --server):
    - Uses wrangler dev
    - Expects static assets in ./dist/client
    `);
    process.exit(0);
  }

  if (args.includes("-v") || args.includes("--version")) {
    console.log("rin-cli v1.1.0");
    process.exit(0);
  }

  try {
    switch (command) {
      case "dev":
        await devCommand(cmdArgs);
        break;
      case "deploy":
        await deployCommand(cmdArgs);
        break;
      case "db":
        await dbCommand(cmdArgs);
        break;
      case "release":
        await releaseCommand(cmdArgs);
        break;
      default:
        logger.error(`Unknown command: ${command}`);
        console.log('Run "rin --help" for available commands');
        process.exit(1);
    }
  } catch (error: any) {
    logger.error(error.message || error);
    if (args.includes("-d") || args.includes("--debug")) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main();
