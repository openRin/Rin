/**
 * 插件运行时：注册、配置读取、钩子派发。
 * 单个插件失败只标为 error 并跳过；派发钩子时插件崩溃不阻断主流程，
 * 只有显式返回字符串或抛 `PluginRejectionError` 才算拦截。
 */

import { Hono as HonoCtor } from 'hono';
import type {
  AppContext,
  CacheImpl,
  DB,
} from '../core/hono-types';
import { createPluginConfigReader } from './config-reader';
import { createPluginLogger } from './logger';
import type {
  CommentHooks,
  CommentInput,
  CreatedComment,
  FeedHooks,
  FeedInput,
  PluginConfigReader,
  PluginContext,
  PluginHooks,
  PluginLogger,
  RegisteredPlugin,
  RinPlugin,
  RoutesHook,
} from './types';

/** 插件主动拒绝本次操作时抛出：会得到用户可见提示。与插件崩溃（只记日志）区分 */
export class PluginRejectionError extends Error {
  constructor(
    public readonly pluginName: string,
    message: string,
  ) {
    super(message);
    this.name = 'PluginRejectionError';
  }
}

/** 启用状态在 serverConfig 里的键，值为逗号分隔的插件名列表（避免插件增删时留孤儿键） */
export const ENABLED_KEY = 'plugins.enabled';

/** 解析启用列表。兼容字符串与数组；空值返回空数组（保守侧：未配置过时不自动启用） */
function parseEnabledList(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof raw !== 'string' || raw.trim() === '') {
    return [];
  }
  return raw
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean);
}

/** 插件注册中心。Worker 里每个 isolate 一份；类本身导出以便测试用独立实例 */
export class PluginRegistry {
  private plugins: RegisteredPlugin[] = [];
  /**
   * 已启用的插件名集合。存在 DB 里，管理员改开关必须立即生效，
   * 因此每个请求开始时调 `syncEnabledFromConfig` 刷新一次并缓存。
   */
  private enabledNames: Set<string> | null = null;

  /** 标记插件状态（后台点开关时调用）。只改内存，持久化由管理接口写 serverConfig 完成 */
  setStatus(name: string, status: RegisteredPlugin['status'], error?: string): boolean {
    const entry = this.plugins.find((p) => p.manifest.name === name);
    if (!entry) return false;

    entry.status = status;
    if (error !== undefined) entry.error = error;
    return true;
  }

  /** 同步启用状态。必须在每个请求开始时调用，否则后台改动对常驻 isolate 不生效 */
  async syncEnabledFromConfig(reader: { get(key: string): Promise<unknown> }): Promise<void> {
    const raw = await reader.get(ENABLED_KEY);
    const names = parseEnabledList(raw);

    this.enabledNames = new Set(names);
    for (const entry of this.plugins) {
      // 出错的插件保持 error 状态：它本身就没跑起来，
      // 重新启用也不会自动修好，不如让管理员看到真实原因
      if (entry.status === 'error') continue;
      entry.status = this.enabledNames.has(entry.manifest.name) ? 'enabled' : 'disabled';
    }
  }

  /** 全部插件（供后台展示） */
  list(): readonly RegisteredPlugin[] {
    return this.plugins;
  }

  /** 已启用的插件。尚未同步状态时假设全部启用（启动阶段不应静默跳过插件） */
  enabled(): RegisteredPlugin[] {
    if (this.enabledNames === null) {
      return this.plugins.filter((p) => p.status !== 'error');
    }
    return this.plugins.filter((p) => p.status === 'enabled');
  }

  /** 当前是否已同步过启用状态。测试用它判断状态是否已生效 */
  hasSynced(): boolean {
    return this.enabledNames !== null;
  }

  /** 插件声明为「可公开」的配置键，供 `/api/plugins/:name/config` 过滤下发 */
  publicSettingsOf(name: string): string[] {
    const entry = this.plugins.find((p) => p.manifest.name === name);
    return entry?.publicSettings ?? [];
  }

  /** 插件的全部设置键（含非公开），供设置页逐键精确读取当前值 */
  settingKeysOf(name: string): string[] {
    const entry = this.plugins.find((p) => p.manifest.name === name);
    return entry?.settingKeys ?? [];
  }

  /** 注册一个插件。校验失败直接抛错（开发期错误）；load 阶段的运行时错误由 `loadAll` 捕获 */
  register(plugin: RinPlugin): void {
    validateManifest(plugin.manifest);

    if (this.plugins.some((p) => p.manifest.name === plugin.manifest.name)) {
      throw new Error(`[plugins] duplicate plugin name: ${plugin.manifest.name}`);
    }

    this.plugins.push({
      manifest: plugin.manifest,
      hooks: stripManifest(plugin),
      // publicSettings 属于清单的一部分，不进 hooks
      publicSettings: plugin.publicSettings ?? [],
      settingKeys: plugin.settingKeys ?? plugin.publicSettings ?? [],
      status: 'enabled',
    });
  }

  /** 执行所有已启用插件的 setup。单个失败只标为 error，不影响其他插件 */
  async loadAll(
    getContext: (pluginName: string) => Promise<PluginContext>,
  ): Promise<void> {
    for (const entry of this.plugins) {
      if (!entry.hooks.setup) continue;

      try {
        const ctx = await getContext(entry.manifest.name);
        await entry.hooks.setup(ctx);
      } catch (error) {
        entry.status = 'error';
        entry.error = error instanceof Error ? error.message : String(error);
        console.error(
          `[plugins] setup failed for ${entry.manifest.name}: ${entry.error}`,
        );
      }
    }
  }

  /** 挂载插件自定义路由到 `/plugins/{name}/`，mount 签名与 `app.route()` 一致 */
  mountRoutes(mount: (path: string, app: PluginApp) => void): void {
    for (const entry of this.enabled()) {
      const routes = entry.hooks.routes;
      if (!routes) continue;

      const app = createHono();
      try {
        // 插件自行决定是否鉴权，这里不预设 admin 检查
        routes(app as never);
        mount(`/plugins/${entry.manifest.name}`, app);
      } catch (error) {
        entry.status = 'error';
        entry.error = error instanceof Error ? error.message : String(error);
        console.error(
          `[plugins] failed to mount routes for ${entry.manifest.name}: ${entry.error}`,
        );
      }
    }
  }

  /** 派发评论提交前钩子。返回拦截原因；插件主动拒绝时抛 `PluginRejectionError` */
  async beforeCommentCreate(
    input: CommentInput,
    ctx: PluginContext,
  ): Promise<string | void> {
    for (const entry of this.enabled()) {
      const hook = entry.hooks.comment?.beforeCreate;
      if (!hook) continue;

      try {
        const result = await hook(input, ctx);
        if (typeof result === 'string' && result.length > 0) {
          return result;
        }
      } catch (error) {
        if (error instanceof PluginRejectionError) throw error;
        // 其他异常不当成拦截 —— 插件崩溃不该让正常用户发不出评论
        logHookError(entry.manifest.name, 'beforeCreate', error);
      }
    }
    return undefined;
  }

  /** 派发评论创建后钩子。异常全吞掉：评论已落库，不能因插件失败而报错 */
  async afterCommentCreate(comment: CreatedComment, ctx: PluginContext): Promise<void> {
    for (const entry of this.enabled()) {
      const hook = entry.hooks.comment?.afterCreate;
      if (!hook) continue;

      try {
        await hook(comment, ctx);
      } catch (error) {
        logHookError(entry.manifest.name, 'afterCreate', error);
      }
    }
  }

  /** 派发评论删除前钩子。异常吞掉，不阻断删除 */
  async beforeCommentDelete(
    comment: { id: number; userId: number | null },
    ctx: PluginContext,
  ): Promise<void> {
    for (const entry of this.enabled()) {
      const hook = entry.hooks.comment?.beforeDelete;
      if (!hook) continue;

      try {
        await hook(comment, ctx);
      } catch (error) {
        logHookError(entry.manifest.name, 'beforeDelete', error);
      }
    }
  }

  /** 派发文章保存前钩子。返回非空字符串表示拒绝 */
  async beforeFeedSave(input: FeedInput, ctx: PluginContext): Promise<string | void> {
    for (const entry of this.enabled()) {
      const hook = entry.hooks.feed?.beforeSave;
      if (!hook) continue;

      try {
        const result = await hook(input, ctx);
        if (typeof result === 'string' && result.length > 0) {
          return result;
        }
      } catch (error) {
        if (error instanceof PluginRejectionError) throw error;
        logHookError(entry.manifest.name, 'feed.beforeSave', error);
      }
    }
    return undefined;
  }

  /** 派发文章保存后钩子。异常吞掉 */
  async afterFeedSave(
    feed: { id: number; title: string; content: string },
    ctx: PluginContext,
  ): Promise<void> {
    for (const entry of this.enabled()) {
      const hook = entry.hooks.feed?.afterSave;
      if (!hook) continue;

      try {
        await hook(feed, ctx);
      } catch (error) {
        logHookError(entry.manifest.name, 'feed.afterSave', error);
      }
    }
  }

  /** 派发文章删除后钩子。异常吞掉 */
  async afterFeedDelete(feed: { id: number }, ctx: PluginContext): Promise<void> {
    for (const entry of this.enabled()) {
      const hook = entry.hooks.feed?.afterDelete;
      if (!hook) continue;

      try {
        await hook(feed, ctx);
      } catch (error) {
        logHookError(entry.manifest.name, 'feed.afterDelete', error);
      }
    }
  }

  /** 供测试用：清空注册表 */
  reset(): void {
    this.plugins = [];
    // 必须一起清：否则测试里重新注册同名插件时会沿用上一次的启用集合
    this.enabledNames = null;
  }
}

function logHookError(pluginName: string, hook: string, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[plugins] ${pluginName} ${hook} failed: ${message}`);
}

function validateManifest(manifest: RinPlugin['manifest']): void {
  if (!manifest || typeof manifest !== 'object') {
    throw new Error('[plugins] manifest is required');
  }
  if (!/^[a-z0-9][a-z0-9-]*$/.test(manifest.name ?? '')) {
    throw new Error(
      `[plugins] invalid plugin name "${manifest.name}", expected lowercase kebab-case`,
    );
  }
  if (!manifest.displayName) {
    throw new Error(`[plugins] ${manifest.name}: displayName is required`);
  }
  if (!manifest.version) {
    throw new Error(`[plugins] ${manifest.name}: version is required`);
  }
}

/** 把 manifest 从 hooks 里剥掉，得到纯钩子对象 */
function stripManifest(plugin: RinPlugin): PluginHooks {
  const { manifest: _manifest, ...hooks } = plugin;
  return hooks;
}

// 插件私有子应用的类型。插件自行决定鉴权，所以不套 RinApp 的 Variables。
type PluginApp = HonoCtor<{ Bindings: Env }>;

/** 创建插件私有子应用。统一在 registry 创建，便于将来换成带鉴权的子应用 */
function createHono(): PluginApp {
  return new HonoCtor<{ Bindings: Env }>();
}

export const pluginRegistry = new PluginRegistry();

/** 构造插件上下文。请求内（带 request）与启动时（无 request）共用 */
export function createPluginContext(params: {
  pluginName: string;
  db: DB;
  cache: CacheImpl;
  serverConfig: CacheImpl;
  clientConfig: CacheImpl;
  env: Env;
  request?: AppContext;
}): PluginContext {
  const { pluginName, ...rest } = params;

  return {
    ...rest,
    log: createPluginLogger(pluginName),
    config: createPluginConfigReader(pluginName, params.serverConfig),
  };
}
