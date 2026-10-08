/** 插件日志。所有输出统一带 `[plugin:名称]` 前缀，方便在 Worker 日志里过滤 */

import type { PluginLogger } from './types';

export function createPluginLogger(pluginName: string): PluginLogger {
  const prefix = `[plugin:${pluginName}]`;

  return {
    info(message: string, data?: unknown): void {
      if (data === undefined) {
        console.log(`${prefix} ${message}`);
      } else {
        console.log(`${prefix} ${message}`, data);
      }
    },

    warn(message: string, data?: unknown): void {
      if (data === undefined) {
        console.warn(`${prefix} ${message}`);
      } else {
        console.warn(`${prefix} ${message}`, data);
      }
    },

    error(message: string, data?: unknown): void {
      if (data === undefined) {
        console.error(`${prefix} ${message}`);
      } else {
        console.error(`${prefix} ${message}`, data);
      }
    },
  };
}
