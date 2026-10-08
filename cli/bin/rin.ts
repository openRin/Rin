#!/usr/bin/env bun
import { runCli } from "../src/main";

/**
 * CLI 入口：用户输入错误打简短提示，真正的 bug（含堆栈）原样输出便于排查。
 */
runCli(Bun.argv.slice(2)).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);

  // 消息里含 "  at " 说明是运行时堆栈，不是用户输入问题
  const isRuntimeError = /\n\s+at\s/.test(message);

  if (isRuntimeError) {
    console.error(message);
  } else {
    console.error(`\n❌ ${message}\n`);
  }

  process.exit(1);
});
