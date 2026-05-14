#!/usr/bin/env bun
import { runCloudflareDeploy } from "../cli/src/tasks/deploy-cf";

const target = (Bun.argv[2] as "all" | "server" | "client" | undefined) ?? "all";
await runCloudflareDeploy(target);
