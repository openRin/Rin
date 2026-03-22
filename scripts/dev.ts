#!/usr/bin/env bun
import { runDevCommand } from "../cli/src/commands/dev";

await runDevCommand(Bun.argv.slice(2));
