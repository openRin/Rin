/**
 * 插件插槽渲染，供两个布局（classic / compact）统一复用；
 * 插入点在 `layout-registry` 的 `renderRouteShell` 里。
 */

import { listPluginSlots, type PluginSlot } from "../plugins/registry";

/** 渲染指定插槽的所有组件，没匹配到时返回 null */
export function PluginSlot({ slot, path }: { slot: PluginSlot; path: string }) {
  const items = listPluginSlots(slot, path);
  if (items.length === 0) return null;

  return (
    <>
      {items.map((item, i) => (
        <item.Component key={`${slot}-${i}`} />
      ))}
    </>
  );
}
