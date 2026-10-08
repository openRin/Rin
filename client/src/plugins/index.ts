/**
 * 前端插件入口：import 各插件并调 `registerFrontendPlugin`（路径须以 `/plugin/` 开头）。
 * 这里注册的是前端页面，服务端钩子在 `server/src/plugins/index.ts` 注册，
 * 两边 manifest.name 相同即为同一个插件。
 */

import { registerFrontendPlugin } from './registry';

import helloPlugin from '../../plugins/hello';
import photoAlbum from '../../plugins/photo-album';

export function registerFrontendPlugins(): void {
  registerFrontendPlugin(helloPlugin);
  registerFrontendPlugin(photoAlbum);
}

// 模块加载时自动注册：保证路由表 import 本文件后即能读到已注册的插件页面。
registerFrontendPlugins();
