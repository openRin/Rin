#!/usr/bin/env bun
import { runLocalDbMigrate } from "../cli/src/tasks/db-migrate-local";

await runLocalDbMigrate();
