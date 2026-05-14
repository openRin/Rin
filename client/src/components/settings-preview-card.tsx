import type { ReactNode } from "react";

export function SettingsPreviewCard({
  children,
  description,
  preview,
  selected,
  title,
  onClick,
}: {
  children?: ReactNode;
  description: string;
  preview: ReactNode;
  selected: boolean;
  title: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-full flex-col rounded-[28px] border text-left transition-all ${
        selected
          ? "border-theme bg-theme/5 shadow-lg shadow-theme/10"
          : "border-black/10 bg-white hover:border-black/20 dark:border-white/10 dark:bg-neutral-950 dark:hover:border-white/20"
      }`}
    >
      <div className="flex items-start justify-between gap-3 border-b border-black/5 px-4 py-3 dark:border-white/10">
        <div>
          <p className="text-sm font-semibold t-primary">{title}</p>
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{description}</p>
          {children ? <div className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">{children}</div> : null}
        </div>
        {selected ? <i className="ri-check-line text-lg text-theme" aria-hidden="true" /> : null}
      </div>
      <div className="flex flex-1 items-stretch bg-[linear-gradient(180deg,rgba(var(--theme-rgb),0.08),transparent)] p-4">
        <div className="flex w-full items-stretch rounded-[22px]">
          {preview}
        </div>
      </div>
    </button>
  );
}
