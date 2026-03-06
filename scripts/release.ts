#!/usr/bin/env bun
import { runReleaseCommand } from "../cli/src/commands/release";

await runReleaseCommand(Bun.argv.slice(2));
