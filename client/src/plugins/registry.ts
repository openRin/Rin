/**
 * 前端插件注册表（React 组件），与服务端 `server/src/plugins` 是两套独立注册表，
 * 通过 `manifest.name` 关联。用法见 `client/plugins/index.ts`。
 * 页面路径必须以 `/plugin/` 开头 —— 插件页面的保留前缀，避免与内置页面撞车。
 */

import type { ComponentType } from "react";

/** 前端插件清单。与服务端同名，字段刻意保持一致 */
export interface FrontendPluginManifest {
  /** 与服务端插件同名，用于两端关联 */
  name: string;
  displayName: string;
  version: string;
  description?: string;
}

/** 单个页面 */
export interface PluginPage {
  /** 路由路径，必须以 `/plugin/` 开头，插件不能覆盖内置页面 */
  path: string;
  /** 侧边栏与浏览器标题用的名字 */
  title: string;
  /** React 组件 */
  Component: ComponentType;
  /**
   * 是否需要管理员权限。为 true 时未登录/非管理员会看到「无权限」。
   * 这只是 UI 层隐藏，不是安全边界 —— 服务端接口必须各自鉴权。
   */
  requireAdmin?: boolean;
  /** 在导航里显示的图标（remixicon 类名），可选 */
  icon?: string;
}

/** 页面插槽 —— 插件内容插在页面的哪个位置，由插件作者按布局需求声明 */
export type PluginSlot =
  /** 页头导航栏与内容之间（轮播图、横幅） */
  | 'below-header'
  /** 页面底部之前（推荐位、版权声明） */
  | 'above-footer'
  /** 文章详情页侧栏 */
  | 'sidebar';

export interface PluginPageSlot {
  /** 要挂载的组件 */
  Component: ComponentType;
  /** 挂在哪个位置 */
  slot: PluginSlot;
  /** 限定只在某些路径出现。`'/'` = 只在首页。不填 = 所有页面 */
  onlyPaths?: string[];
}

/** 插件设置项的字段类型，通用设置页据此渲染表单 */
export type PluginSettingField =
  | { type: 'text'; placeholder?: string }
  | { type: 'textarea'; rows?: number }
  | { type: 'number'; min?: number; max?: number; step?: number }
  | { type: 'boolean' }
  | { type: 'select'; options: { value: string; label: string }[] }
  /** 逗号分隔的字符串列表 */
  | { type: 'stringList'; itemPlaceholder?: string }
  /** 图片列表：每项可上传或填网址，上传走 `/api/storage` */
  | { type: 'imageList'; maxItems?: number };

/** 单个设置项 */
export interface PluginSetting {
  /** 配置键。不含插件名前缀，内部自动拼成 `{插件名}.{key}` */
  key: string;
  /** 设置项名称 */
  label: string;
  /** 一句话说明作用 */
  description?: string;
  /** 字段类型，通用设置页据此渲染表单 */
  field: PluginSettingField;
  /** 默认值。imageList 用数组，stringList 用字符串 */
  defaultValue?: string | number | boolean | string[];
}

export interface FrontendPlugin {
  manifest: FrontendPluginManifest;
  /** 该插件提供的独立页面 */
  pages: PluginPage[];
  /** 挂到页面插槽上的组件；与 `pages`（独立路由）分开 */
  slots?: PluginPageSlot[];
  /**
   * 需要在后台暴露的设置项，在 `/admin/plugins/<name>/settings` 填写。
   * 值存到 serverConfig 的 `{插件名}.{key}`，插件自行读取。
   */
  settings?: PluginSetting[];
}

/** 页面前缀。插件页面只能用这个前缀 */
export const PLUGIN_PATH_PREFIX = '/plugin/';

/** 插件页面在导航中的挂载点 */
export const PLUGIN_NAV_SLOT = '/plugin';

const registry: FrontendPlugin[] = [];

/** 校验路径合法性。注册时就拦住，比渲染时才发现好 */
function isValidPath(path: string): boolean {
  return path.startsWith(PLUGIN_PATH_PREFIX) && path.length > PLUGIN_PATH_PREFIX.length;
}

/** 注册前端插件。重复注册、路径非法或冲突都会抛错（开发期错误应立刻暴露） */
export function registerFrontendPlugin(plugin: FrontendPlugin): void {
  if (registry.some((p) => p.manifest.name === plugin.manifest.name)) {
    throw new Error(`[plugin] duplicate frontend plugin: ${plugin.manifest.name}`);
  }

  for (const page of plugin.pages) {
    if (!isValidPath(page.path)) {
      throw new Error(
        `[plugin] ${plugin.manifest.name}: page path must start with ${PLUGIN_PATH_PREFIX}, got "${page.path}"`,
      );
    }

    const owner = findPageOwner(page.path);
    if (owner) {
      throw new Error(
        `[plugin] path conflict: "${page.path}" is already provided by ${owner}`,
      );
    }
  }

  registry.push(plugin);
}

/** 找出占用某路径的插件名 */
function findPageOwner(path: string): string | null {
  for (const plugin of registry) {
    if (plugin.pages.some((page) => page.path === path)) {
      return plugin.manifest.name;
    }
  }
  return null;
}

/** 全部已注册的前端插件 */
export function listFrontendPlugins(): readonly FrontendPlugin[] {
  return registry;
}

/** 全部插件页面，供路由表展开 */
export function listPluginPages(): PluginPage[] {
  return registry.flatMap((plugin) => plugin.pages);
}

/** 按路径找页面 */
export function findPluginPage(path: string): PluginPage | undefined {
  return listPluginPages().find((page) => page.path === path);
}

/**
 * 找出挂在指定插槽、且适用于当前路径的组件。
 * @param slot  插槽位置
 * @param path  当前路径，用于过滤 `onlyPaths`
 */
export function listPluginSlots(
  slot: PluginSlot,
  path: string,
): PluginPageSlot[] {
  const matched: PluginPageSlot[] = [];

  for (const plugin of registry) {
    for (const item of plugin.slots ?? []) {
      if (item.slot !== slot) continue;
      // onlyPaths 为空表示不限路径
      if (item.onlyPaths && item.onlyPaths.length > 0) {
        if (!item.onlyPaths.includes(path)) continue;
      }
      matched.push(item);
    }
  }

  return matched;
}

/** 找出某个插件的设置项声明 */
export function findPluginSettings(name: string): PluginSetting[] {
  return registry.find((p) => p.manifest.name === name)?.settings ?? [];
}

/** 清空注册表。测试用 */
export function resetFrontendPlugins(): void {
  registry.length = 0;
}
