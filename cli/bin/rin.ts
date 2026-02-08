#!/usr/bin/env bun
/**
 * Rin CLI - Unified command line interface for Rin blog platform
 * 
 * Usage:
 *   rin dev                    Start development server
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

// Commands
async function devCommand(args: string[]) {
  const { values } = parseArgs({
    args,
    options: {
      port: { type: "string", short: "p", default: "5173" },
      "backend-port": { type: "string", short: "b", default: "11498" },
      "client-only": { type: "boolean" },
      "server-only": { type: "boolean" },
      "no-migrate": { type: "boolean" },
    },
  });

  const env = await loadEnv();
  const FRONTEND_PORT = parseInt(values.port || "5173");
  const BACKEND_PORT = parseInt(values["backend-port"] || "11498");

  // Check ports
  if (!values["server-only"]) {
    if (!(await checkPort(FRONTEND_PORT))) {
      logger.error(`Port ${FRONTEND_PORT} is already in use`);
      process.exit(1);
    }
  }

  if (!values["client-only"]) {
    if (!(await checkPort(BACKEND_PORT))) {
      logger.error(`Port ${BACKEND_PORT} is already in use`);
      process.exit(1);
    }
  }

  // Start servers
  const processes: any[] = [];

  if (!values["client-only"]) {
    logger.info("Starting backend server...");
    const backend = Bun.spawn(["bun", "wrangler", "dev", "--port", String(BACKEND_PORT)], {
      stdout: "inherit",
      stderr: "inherit",
    });
    processes.push(backend);
  }

  if (!values["server-only"]) {
    logger.info("Starting frontend server...");
    const frontend = Bun.spawn(["bun", "--filter", "./client", "dev", "--port", String(FRONTEND_PORT)], {
      stdout: "inherit",
      stderr: "inherit",
    });
    processes.push(frontend);
  }

  // Handle shutdown
  const shutdown = () => {
    logger.info("Shutting down...");
    processes.forEach((p) => p.kill("SIGTERM"));
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
    await $`bun ${releaseScript} ${version}`;
  } else {
    logger.error("Release script not found");
    process.exit(1);
  }
}

// Main
async function main() {
  const { values, positionals } = parseArgs({
    args: Bun.argv.slice(2),
    options: {
      help: { type: "boolean", short: "h" },
      version: { type: "boolean", short: "v" },
      debug: { type: "boolean", short: "d" },
    },
    allowPositionals: true,
  });

  if (values.help) {
    console.log(`
Rin CLI - Unified command line interface for Rin blog platform

Usage: rin <command> [options]

Commands:
  dev                          Start development server
    -p, --port <port>          Frontend port (default: 5173)
    -b, --backend-port <port>  Backend port (default: 11498)
    --client-only              Start only frontend
    --server-only              Start only backend
    --no-migrate               Skip database migration

  deploy                       Deploy to Cloudflare
    --preview                  Deploy to preview environment
    --server                   Deploy only backend
    --client                   Deploy only frontend

  db                           Database operations
    migrate                    Run database migrations

  release                      Create a new release
    <version>                  Version (patch/minor/major/x.y.z)

Options:
  -h, --help                   Show help
  -v, --version                Show version
  -d, --debug                  Enable debug mode

Examples:
  rin dev                      Start development server
  rin deploy                   Deploy to production
  rin deploy --preview         Deploy to preview
  rin db migrate               Run database migrations
  rin release patch            Bump patch version
    `);
    process.exit(0);
  }

  if (values.version) {
    console.log("rin-cli v1.0.0");
    process.exit(0);
  }

  const [command, ...cmdArgs] = positionals;

  if (!command) {
    console.log("Usage: rin <command> [options]");
    console.log('Run "rin --help" for more information');
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
    if (values.debug) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main();
