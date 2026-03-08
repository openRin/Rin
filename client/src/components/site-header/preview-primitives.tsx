import type { CSSProperties, ReactNode } from "react";
import type { HeaderLayoutPreviewData } from "./layout-types";

export function PreviewCanvas({
  children,
  className = "",
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return <div className={`space-y-3 ${className}`.trim()} style={style}>{children}</div>;
}

export function PreviewBrand({ data, compact = false }: { data: HeaderLayoutPreviewData; compact?: boolean }) {
  return (
    <div className="flex items-center gap-2 overflow-hidden">
      <PreviewAvatar avatar={data.avatar} themeColor={data.themeColor} compact={compact} />
      <div className="min-w-0">
        <PreviewName name={data.name} compact={compact} />
        {compact ? null : <PreviewSubtitle text="Description" />}
      </div>
    </div>
  );
}

export function PreviewNav({
  items,
  center = false,
  compact = false,
  vertical = false,
  themeColor,
}: {
  items: string[];
  center?: boolean;
  compact?: boolean;
  vertical?: boolean;
  themeColor: string;
}) {
  return (
    <div className={vertical ? "flex flex-col items-start gap-1.5" : `flex items-center ${compact ? "gap-3" : "gap-4"} ${center ? "justify-center" : ""}`}>
      {items.map((item, index) => (
        <span
          key={item}
          className={`truncate text-[9px] font-medium leading-none ${index === 0 ? "" : "text-neutral-500 dark:text-neutral-400"}`}
          style={{
            maxWidth: vertical ? "4rem" : compact ? "2.75rem" : "3.5rem",
            ...(index === 0 ? { color: themeColor } : {}),
          }}
        >
          {item}
        </span>
      ))}
    </div>
  );
}

export function PreviewActions({
  minimal = false,
  stacked = false,
  themeColor,
}: {
  minimal?: boolean;
  stacked?: boolean;
  themeColor: string;
}) {
  return (
    <div className={stacked ? "flex flex-col items-start gap-1.5" : "flex items-center justify-end gap-1.5"}>
      <div className={`h-6 w-6 rounded-full ${minimal ? "bg-black/[0.06] dark:bg-white/[0.08]" : "border border-black/10 dark:border-white/10"}`} />
      <div className={`h-6 w-6 rounded-full ${minimal ? "bg-black/[0.06] dark:bg-white/[0.08]" : "border border-black/10 dark:border-white/10"}`} />
      <div
        className={`h-6 w-6 rounded-full ${minimal ? "" : "border border-black/10 dark:border-white/10"}`}
        style={{ backgroundColor: minimal ? `${themeColor}33` : `${themeColor}22` }}
      />
    </div>
  );
}

export function PreviewContent({ transparent = false }: { transparent?: boolean }) {
  return (
    <div
      className={`h-12 rounded-2xl ${
        transparent
          ? "bg-white/35 ring-1 ring-black/5 dark:bg-white/[0.03] dark:ring-white/10"
          : "bg-black/[0.03] dark:bg-white/[0.04]"
      }`}
    />
  );
}

function PreviewAvatar({
  avatar,
  themeColor,
  compact = false,
}: {
  avatar: string;
  themeColor: string;
  compact?: boolean;
}) {
  return avatar ? (
    <img src={avatar} alt="" className={`${compact ? "h-7 w-7 rounded-xl" : "h-8 w-8 rounded-full"} shrink-0 object-cover`} />
  ) : (
    <div className={`${compact ? "h-7 w-7 rounded-xl" : "h-8 w-8 rounded-full"} shrink-0`} style={{ backgroundColor: `${themeColor}33` }} />
  );
}

function PreviewName({ name, compact = false }: { name: string; compact?: boolean }) {
  const displayName = name.trim() || "Rin";
  return (
    <p className={`truncate font-semibold text-neutral-900 dark:text-neutral-100 ${compact ? "max-w-16 text-[10px]" : "max-w-24 text-[10px]"}`}>
      {displayName}
    </p>
  );
}

function PreviewSubtitle({ text }: { text: string }) {
  return <p className="mt-1 max-w-20 truncate text-[8px] leading-none text-neutral-400 dark:text-neutral-500">{text}</p>;
}
