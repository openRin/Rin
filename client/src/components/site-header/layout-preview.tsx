import type { HeaderLayoutOption } from "./layout-options";
import { getHeaderLayoutDefinition } from "./layout-registry";
import type { HeaderLayoutPreviewData } from "./layout-types";

export function HeaderLayoutPreview({
  data,
  layout,
  selected,
  title,
  description,
  onClick,
}: {
  data: HeaderLayoutPreviewData;
  layout: HeaderLayoutOption;
  selected: boolean;
  title: string;
  description: string;
  onClick: () => void;
}) {
  const layoutDefinition = getHeaderLayoutDefinition(layout);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-2xl border p-3 text-left transition-all ${
        selected
          ? "border-theme bg-theme/5 shadow-md shadow-theme/10"
          : "border-black/10 bg-white/70 hover:border-black/20 hover:bg-white dark:border-white/10 dark:bg-white/[0.03] dark:hover:bg-white/[0.05]"
      }`}
    >
      <div className="mb-3 overflow-hidden rounded-2xl bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(246,247,251,0.92))] ring-1 ring-black/5 dark:bg-[linear-gradient(180deg,rgba(24,24,27,0.96),rgba(14,14,18,0.92))] dark:ring-white/10">
        {layoutDefinition.renderPreview(data)}
      </div>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold t-primary">{title}</p>
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{description}</p>
        </div>
        {selected ? <i className="ri-check-line text-lg text-theme" /> : null}
      </div>
    </button>
  );
}
