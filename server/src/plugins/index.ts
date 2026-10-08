/**
 * 插件入口。新增插件：在 `server/plugins/<name>/index.ts` 写好后
 * import 并加进 `ALL_PLUGINS`，再到后台配置 `plugins.<name>.enabled` 控制启停。
 * 数组顺序 = 钩子执行顺序，`beforeCreate` 命中拒绝即短路。
 */

import type { RinPlugin } from './types';
import { pluginRegistry } from './registry';

import commentGuard from '../../plugins/comment-guard';
import photoAlbum from '../../plugins/photo-album';

/** 全部内置插件。顺序有意义：靠前的插件先拿到决定权 */
const ALL_PLUGINS: RinPlugin[] = [
  commentGuard,
  photoAlbum,
];

/** 注册全部插件。可重复调用（先清空）；单个注册失败只跳过并打日志，不影响其他插件 */
export function registerPlugins(): void {
  pluginRegistry.reset();

  for (const plugin of ALL_PLUGINS) {
    try {
      pluginRegistry.register(plugin);
    } catch (error) {
      const name = plugin?.manifest?.name ?? 'unknown';
      console.error(`[plugins] failed to register ${name}:`, error);
    }
  }

  const registered = pluginRegistry.list();
  console.log(
    `[plugins] ${registered.length} plugin(s) registered: ` +
      registered.map((p) => p.manifest.name).join(', '),
  );
}

export { pluginRegistry } from './registry';
export type * from './types';
