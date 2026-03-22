import type { ReactNode } from "react";

export function SettingsSectionTitle({
  title,
  eyebrow,
}: {
  title: string;
  eyebrow?: string;
}) {
  return (
    <div className="pt-6 first:pt-0">
      {eyebrow ? <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-theme/70">{eyebrow}</p> : null}
      <h2 className="mt-1 text-sm font-semibold uppercase tracking-[0.18em] text-neutral-700 dark:text-neutral-200">{title}</h2>
    </div>
  );
}

export function SettingsCard({
  children,
  tone = "default",
}: {
  children: ReactNode;
  tone?: "default" | "success" | "danger" | "warning";
}) {
  const toneClass =
    tone === "success"
      ? "border-emerald-200/70 dark:border-emerald-800/60"
      : tone === "danger"
        ? "border-rose-200/80 dark:border-rose-900/60"
        : tone === "warning"
          ? "border-amber-200/80 dark:border-amber-900/60"
          : "border-neutral-200/80 dark:border-neutral-800/80";

  return (
    <div
      className={`w-full rounded-xl border ${toneClass} bg-w p-5`}
    >
      {children}
    </div>
  );
}

export function SettingsCardHeader({
  title,
  description,
  badge,
}: {
  title: string;
  description: string;
  badge?: ReactNode;
}) {
  return (
    <div className="min-w-0 flex-1">
      <div className="flex items-center gap-2">
        <p className="text-base font-semibold tracking-[-0.02em] t-primary">{title}</p>
        {badge}
      </div>
      <p className="mt-1 max-w-2xl text-sm leading-6 text-neutral-500 dark:text-neutral-400">{description}</p>
    </div>
  );
}

export function SettingsCardRow({
  header,
  action,
}: {
  header: ReactNode;
  action: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      {header}
      <div className="flex shrink-0 items-center gap-3 md:justify-end">{action}</div>
    </div>
  );
}

export function SettingsCardBody({ children }: { children: ReactNode }) {
  return <div className="mt-4 border-t border-black/5 pt-4 dark:border-white/5">{children}</div>;
}

export function SettingsBadge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "success" | "warning";
}) {
  const toneClass =
    tone === "success"
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300"
      : tone === "warning"
        ? "bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300"
        : "bg-neutral-100 text-neutral-700 dark:bg-neutral-900 dark:text-neutral-300";

  return <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${toneClass}`}>{children}</span>;
}
