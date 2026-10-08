/**
 * 插件管理 API（管理员），挂在 /api/admin/plugins。
 * 启停状态存在 `serverConfig.plugins.enabled`（逗号分隔列表）——
 * 存列表的好处是插件增删时不用清理孤儿键。
 * 列表接口带上每个插件声明的能力，便于管理员了解插件用途。
 */

import { Hono } from "hono";
import { FEED_ERROR_CODES } from "@rin/api";
import type { AppContext } from "../core/hono-types";

import { ENABLED_KEY, pluginRegistry } from "../plugins/registry";
import type { RegisteredPlugin } from "../plugins/types";

/**
 * 判断插件声明了哪些扩展点。
 *
 * 返回给人看的，不给机器读 —— 后台展示用。
 */
function describeCapabilities(entry: RegisteredPlugin): string[] {
  const caps: string[] = [];
  if (entry.hooks.comment?.beforeCreate) caps.push('comment.beforeCreate');
  if (entry.hooks.comment?.afterCreate) caps.push('comment.afterCreate');
  if (entry.hooks.comment?.beforeDelete) caps.push('comment.beforeDelete');
  if (entry.hooks.feed?.beforeSave) caps.push('feed.beforeSave');
  if (entry.hooks.feed?.afterSave) caps.push('feed.afterSave');
  if (entry.hooks.feed?.afterDelete) caps.push('feed.afterDelete');
  if (entry.hooks.routes) caps.push('routes');
  if (entry.hooks.setup) caps.push('setup');
  return caps;
}

/**
 * 管理员鉴权，区分 401 与 403。
 *
 * 不用 `adminOnly`：它对「未登录」和「已登录非管理员」一律返回 401，
 * 但 401 意味着「请重新登录」，会让调用方在权限问题上白跑一趟。
 */
function adminJson(handler: (c: AppContext) => Promise<Response> | Response) {
  return async (c: AppContext) => {
    if (!c.get('uid')) {
      return c.json({ error: 'Authentication required' }, 401);
    }
    if (!c.get('admin')) {
      return c.json({ error: 'Administrator permission required' }, 403);
    }
    return handler(c);
  };
}

export function AdminPluginService(): Hono {
  const app = new Hono();
  app.get('/', adminJson(async (c: AppContext) => {
    const entries = pluginRegistry.list();

    return c.json({
      enabledKey: ENABLED_KEY,
      plugins: entries.map((entry) => ({
        name: entry.manifest.name,
        displayName: entry.manifest.displayName,
        version: entry.manifest.version,
        description: entry.manifest.description ?? '',
        author: entry.manifest.author ?? '',
        status: entry.status,
        error: entry.error ?? null,
        capabilities: describeCapabilities(entry),
        /** 路由前缀，仅当插件声明了 routes 钩子 */
        apiPrefix: entry.hooks.routes ? `/plugins/${entry.manifest.name}` : null,
      })),
    });
  }));

  /** PUT /api/admin/plugins/:name — 启停插件。body: `{ enabled: boolean }` */
  app.put('/:name', adminJson(async (c: AppContext) => {
    const name = c.req.param('name');

    const entry = pluginRegistry.list().find((p) => p.manifest.name === name);
    if (!entry) {
      return c.json(
        { success: false, error: { code: 'PLUGIN_NOT_FOUND', message: `Unknown plugin: ${name}` } },
        404,
      );
    }

    // 出错的插件不允许切换：它没跑起来，启用也不会自动修好，
    // 反而会让管理员误以为已经生效
    if (entry.status === 'error') {
      return c.json(
        {
          success: false,
          error: {
            code: 'PLUGIN_ERRORED',
            message: `Plugin failed to load: ${entry.error ?? 'unknown error'}`,
          },
        },
        409,
      );
    }

    const body = await c.req.json().catch(() => null) as { enabled?: unknown } | null;
    if (body === null || typeof body.enabled !== 'boolean') {
      return c.json(
        {
          success: false,
          error: {
            code: FEED_ERROR_CODES.FEED_VALIDATION_FAILED,
            message: 'Body must be { enabled: boolean }',
          },
        },
        400,
      );
    }

    const serverConfig = c.get('serverConfig');
    const raw = await serverConfig.get(ENABLED_KEY);

    // 复用 registry 的解析规则，保证读回来和写进去是同一套语义
    const current = parseNames(raw);
    const next = body.enabled
      ? [...new Set([...current, name])]
      : current.filter((item) => item !== name);

    await serverConfig.set(ENABLED_KEY, next.join(','), true);

    // 立刻更新内存状态：不等下一个请求，
    // 这样管理接口返回后前端刷新列表看到的就是新状态
    pluginRegistry.setStatus(name, body.enabled ? 'enabled' : 'disabled');
    await pluginRegistry.syncEnabledFromConfig(serverConfig);

    console.log(
      `[plugins] ${body.enabled ? 'enabled' : 'disabled'} ${name} by admin`,
    );

    return c.json({
      success: true,
      data: {
        name,
        status: body.enabled ? 'enabled' : 'disabled',
        enabledKey: ENABLED_KEY,
        enabledList: next,
      },
    });
  }));

  /** GET /api/admin/plugins/:name/settings — 读设置。不校验插件存在：纯前端插件也有设置页 */
  app.get('/:name/settings', adminJson(async (c: AppContext) => {
    const name = c.req.param('name');
    const serverConfig = c.get('serverConfig');

    /**
     * 逐键 get() 而不用 getByPrefix：后者依赖内存 cache 快照，
     * 在「刚 PUT 写入、快照未刷新」的窗口会读不到值；get() 直读存储才可靠。
     * 键名来自插件自己声明的 settingKeys，不另猜清单。
     */
    const keys = pluginRegistry.settingKeysOf(name);

    const values: Record<string, string> = {};
    for (const key of keys) {
      const value = await serverConfig.get(`${name}.${key}`);
      if (value !== null && value !== undefined) {
        values[key] = String(value);
      }
    }

    return c.json({ success: true, data: { name, values } });
  }));

  /** PUT /api/admin/plugins/:name/settings — 批量写入。只接受标量与字符串数组 */
  app.put('/:name/settings', adminJson(async (c: AppContext) => {
    const name = c.req.param('name');
    const body = await c.req.json().catch(() => null) as { values?: unknown } | null;

    if (!body || typeof body.values !== 'object' || body.values === null) {
      return c.json(
        {
          success: false,
          error: {
            code: FEED_ERROR_CODES.FEED_VALIDATION_FAILED,
            message: 'Body must be { values: object }',
          },
        },
        400,
      );
    }

    const entries = Object.entries(body.values as Record<string, unknown>);
    const rejected = entries.filter(([, value]) => !isStorableValue(value));
    if (rejected.length > 0) {
      return c.json(
        {
          success: false,
          error: {
            code: FEED_ERROR_CODES.FEED_VALIDATION_FAILED,
            message: `Unsupported value type for keys: ${rejected.map(([k]) => k).join(', ')}`,
          },
        },
        400,
      );
    }

    const serverConfig = c.get('serverConfig');
    const saved: Record<string, string> = {};

    for (const [key, value] of entries) {
      // 配置键必须是 `{插件名}.{键}`，键名本身不含点号
      if (key.includes('.') || key.length === 0) {
        return c.json(
          {
            success: false,
            error: {
              code: FEED_ERROR_CODES.FEED_VALIDATION_FAILED,
              message: `Invalid setting key: ${key}`,
            },
          },
          400,
        );
      }

      const fullKey = `${name}.${key}`;
      const serialized =
        Array.isArray(value) ? value.join(',') : String(value as string | number | boolean);
      saved[key] = serialized;
      await serverConfig.set(fullKey, serialized, true);
    }

    console.log(
      `[plugins] settings updated for ${name}: ${Object.keys(saved).join(', ') || '(empty)'}`,
    );

    return c.json({ success: true, data: { name, values: saved } });
  }));

  return app;
}

/** 是否可存进文本配置；数组元素必须也是标量，拒绝嵌套结构 */
function isStorableValue(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (Array.isArray(value)) {
    // 数组的元素必须都是标量 —— 字符串数组才能安全序列化
    return value.every((item) => isStorableValue(item) && !Array.isArray(item));
  }
  const type = typeof value;
  return type === 'string' || type === 'number' || type === 'boolean';
}

/** 解析启用列表。与 registry 内部逻辑保持一致 */
function parseNames(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof raw !== 'string' || raw.trim() === '') {
    return [];
  }
  return raw.split(',').map((item) => item.trim()).filter(Boolean);
}
