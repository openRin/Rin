/**
 * 插件公开配置读取，挂 /api/plugins/:name/config，无需登录。
 * serverConfig 混有敏感值不能整体下发，因此只返回 manifest 里
 * 用 `publicSettings` 显式声明过的键；未声明的插件返回空对象。
 */

import { Hono } from "hono";
import type { AppContext } from "../core/hono-types";
import { pluginRegistry } from "../plugins/registry";

/** 缓存头：配置改动不频繁，但也不该每次都回源 */
const CACHE_CONTROL = 'public, max-age=60';

export function PluginConfigService(): Hono {
  const app = new Hono();

  /**
   * GET /api/plugins/:name/config
   *
   * 返回 `{ values: Record<string, string> }`，只含公开键。
   */
  app.get('/:name/config', async (c: AppContext) => {
    const name = c.req.param('name');

    // 停用的插件不该对外提供配置 —— 它本来就不该工作
    const entry = pluginRegistry.list().find((p) => p.manifest.name === name);
    if (!entry || entry.status === 'disabled' || entry.status === 'error') {
      return c.json({ success: false, error: { code: 'PLUGIN_UNAVAILABLE' } }, 404);
    }

    const keys = pluginRegistry.publicSettingsOf(name);
    if (keys.length === 0) {
      return c.json({ name, values: {} }, 200, { 'Cache-Control': CACHE_CONTROL });
    }

    const serverConfig = c.get('serverConfig');
    const values: Record<string, string> = {};

    // 逐键读取：配置量很小，不值得引入批量读接口，也避开 getByPrefix 的实现差异。
    for (const key of keys) {
      // 只读插件自己声明过的键，杜绝越权读取其他配置
      const value = await serverConfig.get(`${name}.${key}`);
      if (value !== null && value !== undefined) {
        values[key] = String(value);
      }
    }

    return c.json({ name, values }, 200, { 'Cache-Control': CACHE_CONTROL });
  });

  return app;
}
