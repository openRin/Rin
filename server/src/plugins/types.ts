/**
 * 插件系统的核心类型定义。
 * 插件是编译期内置且完全受信任的（可访问 db / cache / config / env），
 * 不做运行时动态加载 —— Worker 下无法做类型检查，自用项目也不需要生态。
 */

import type {
  AppContext,
  CacheImpl,
  DB,
} from '../core/hono-types';
import type { Hono } from 'hono';

/** 插件清单。每个插件必须导出这个对象。`name` 用于配置查找、启停开关与日志 */
export interface PluginManifest {
  /** 全局唯一的小写短横线标识，如 `comment-guard` */
  name: string;
  /** 展示名，如「评论敏感词过滤」 */
  displayName: string;
  /** 版本号，修改插件行为时应递增 */
  version: string;
  /** 一句话说明这个插件做什么。显示在后台插件列表里 */
  description?: string;
  /** 作者名或仓库地址 */
  author?: string;
}

/** 评论生命周期钩子。`beforeCreate` 返回字符串或抛错即拦截本次提交 */
export interface CommentHooks {
  /** 评论提交前。返回非空字符串会拒绝本次提交（用于敏感词、频率限制等） */
  beforeCreate?(input: CommentInput, ctx: PluginContext): Promise<string | void> | string | void;

  /** 评论创建后（已落库）。抛错不回滚评论，只记日志 */
  afterCreate?(comment: CreatedComment, ctx: PluginContext): Promise<void> | void;

  /** 评论删除前。用于级联清理插件自己附加的数据 */
  beforeDelete?(comment: { id: number; userId: number | null }, ctx: PluginContext): Promise<void> | void;
}

/** 传给 `beforeCreate` 的评论输入（尚未落库） */
export interface CommentInput {
  feedId: string;
  content: string;
  /** 登录用户 id；游客为 null */
  userId: number | null;
  guestName?: string;
  guestEmail?: string;
  guestWebsite?: string;
  /** 调用方是否已登录 */
  isLoggedIn: boolean;
  /** 调用方是否为管理员 */
  isAdmin: boolean;
}

/** 传给 `afterCreate` 的已创建评论 */
export interface CreatedComment {
  id: number;
  feedId: string;
  userId: number | null;
  content: string;
  authorName: string;
  approved: boolean;
}

/** 文章生命周期钩子 */
export interface FeedHooks {
  /** 文章创建/更新前。返回非空字符串会拒绝 */
  beforeSave?(input: FeedInput, ctx: PluginContext): Promise<string | void> | string | void;

  /** 文章创建/更新后。用于重建索引、推送订阅、清理缓存 */
  afterSave?(feed: { id: number; title: string; content: string }, ctx: PluginContext): Promise<void> | void;

  /** 文章删除后。用于清理插件附加数据 */
  afterDelete?(feed: { id: number }, ctx: PluginContext): Promise<void> | void;
}

export interface FeedInput {
  id?: number;
  title: string;
  content: string;
  /** 相对原内容是否有改动。为 false 时插件可跳过昂贵处理 */
  changed: boolean;
}

/** 插件可访问的上下文 */
export interface PluginContext {
  db: DB;
  cache: CacheImpl;
  serverConfig: CacheImpl;
  clientConfig: CacheImpl;
  env: Env;
  /** 请求上下文；后台任务里为 undefined */
  request?: AppContext;
  /** 插件自己的日志，带插件名前缀便于过滤 */
  log: PluginLogger;
  /** 读取插件配置。key 形如 `blockedWords`，自动加上插件名前缀 */
  config: PluginConfigReader;
}

/** 插件日志。自动带上插件名前缀 */
export interface PluginLogger {
  info(message: string, data?: unknown): void;
  warn(message: string, data?: unknown): void;
  error(message: string, data?: unknown): void;
}

/** 插件配置读取。走现有 serverConfig 体系，键前缀用插件名，后台可直接编辑 */
export interface PluginConfigReader {
  /** 读字符串。key 不含插件名前缀，内部自动拼成 `{插件名}.{key}`；缺失时返回 defaultValue */
  string(key: string, defaultValue: string): Promise<string>;
  /** 读数字 */
  number(key: string, defaultValue: number): Promise<number>;
  /** 读布尔 */
  boolean(key: string, defaultValue: boolean): Promise<boolean>;
  /** 读字符串数组（存储时用逗号分隔） */
  stringList(key: string, defaultValue: string[]): Promise<string[]>;
}

/** 自定义 API 端点：插件把 Hono 子路由挂到 `/plugins/{插件名}/` 下，自行决定鉴权 */
export type RoutesHook = (app: Hono) => void;

/** 插件可扩展的全部能力。所有字段可选，未提供的钩子注册时跳过 */
export interface PluginHooks {
  comment?: CommentHooks;
  feed?: FeedHooks;
  /** 挂载自定义路由到 `/plugins/{name}/`，插件自己决定是否校验 `c.get('admin')` */
  routes?: RoutesHook;
  /** 应用启动时执行一次。抛错会让该插件被跳过，不影响其他插件 */
  setup?(ctx: PluginContext): Promise<void> | void;
}

/** 一个完整的插件：清单 + 钩子。约定放在 `server/plugins/<name>/index.ts` 默认导出 */
export interface RinPlugin extends PluginHooks {
  manifest: PluginManifest;
  /**
   * 可公开读取的配置键（不含插件名前缀），只有这些会被
   * `/api/plugins/:name/config` 下发 —— serverConfig 混着敏感值，不能整体下发。
   * 留空 = 不对外公开任何配置。
   */
  publicSettings?: string[];

  /**
   * 该插件的全部设置键（含非公开），供管理员设置页逐键 `get(key)` 读回当前值
   * （配置只能精确匹配读取，不知道键名就没法取）。通常与前端声明的 `key` 一一对应。
   */
  settingKeys?: string[];
}

/** 已注册的插件实例。仅 `status: 'enabled'` 参与钩子派发；`error` 记录 load/setup 失败原因 */
export interface RegisteredPlugin {
  manifest: PluginManifest;
  hooks: PluginHooks;
  /** 声明为可公开的配置键。供前端的插件组件读取自身设置 */
  publicSettings: string[];
  /** 该插件的全部设置键（含非公开），供管理员设置页逐键读回 */
  settingKeys: string[];
  status: 'enabled' | 'disabled' | 'error';
  /** 加载或 setup 失败的原因。status 为 'error' 时非空 */
  error?: string;
}
