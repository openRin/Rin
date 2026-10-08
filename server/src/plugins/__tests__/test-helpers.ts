/**
 * 插件测试的公共辅助。
 * db / cache 等重量级依赖用 unknown 中转一次绕过 tsc 的类型检查，
 * 测试只关心配置读取与钩子派发，不涉及真实数据库访问。
 */

import type { CacheImpl } from '../../core/hono-types';
import { createPluginConfigReader } from '../config-reader';
import type { PluginContext } from '../types';

/** 只实现 get 的最小 CacheImpl，够配置读取用 */
export function makeConfig(values: Record<string, unknown>): CacheImpl {
  return {
    get: async (key: string) => (key in values ? (values[key] ?? null) : null),
    getOrDefault: async <T>(key: string, defaultValue: T) =>
      (values[key] as T) ?? defaultValue,
  } as unknown as CacheImpl;
}

/** 静默 logger，避免测试输出被日志淹没 */
export const silentLog = {
  info() {},
  warn() {},
  error() {},
};

/** 构造一个测试用 PluginContext；真要测 DB 行为应该用 setupTestApp 那套 */
export function makePluginContext(params: {
  pluginName: string;
  serverConfig?: CacheImpl;
  values?: Record<string, unknown>;
}): PluginContext {
  const serverConfig = params.serverConfig ?? makeConfig(params.values ?? {});

  return {
    db: {} as never,
    cache: {} as never,
    serverConfig,
    clientConfig: serverConfig,
    env: {} as Env,
    log: silentLog,
    config: createPluginConfigReader(params.pluginName, serverConfig),
  };
}
