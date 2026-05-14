import { normalizeHeaderLayout, type HeaderLayoutOption } from "./layout-options";
import { classicLayoutDefinition } from "./layouts/classic-layout";
import { compactLayoutDefinition } from "./layouts/compact-layout";
import type { HeaderLayoutRegistry } from "./layout-types";

const layoutRegistry: HeaderLayoutRegistry = {
  classic: classicLayoutDefinition,
  compact: compactLayoutDefinition,
};

export function getHeaderLayoutDefinition(layout: HeaderLayoutOption | string | null | undefined) {
  return layoutRegistry[normalizeHeaderLayout(layout ?? undefined)];
}
