import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";

function joinClasses(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function FlatPanel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={joinClasses("rounded-2xl border border-black/10 bg-w dark:border-white/10", className)}>
      {children}
    </div>
  );
}

export function FlatInset({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={joinClasses("rounded-2xl border border-black/10 bg-secondary dark:border-white/10", className)}>
      {children}
    </div>
  );
}

export function FlatTabButton({
  active = false,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean;
}) {
  return (
    <button
      {...props}
      className={joinClasses(
        "rounded-xl px-3 py-2 text-sm transition-colors",
        active ? "bg-w text-theme" : "text-neutral-500 dark:text-neutral-400",
        className,
      )}
    />
  );
}

export function FlatActionButton({
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={joinClasses("rounded-full border border-black/10 bg-secondary px-4 py-2 dark:border-white/10", className)}
    />
  );
}

export function FlatMetaRow({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      className={joinClasses(
        "flex select-none flex-row items-center justify-between rounded-2xl border border-black/10 bg-secondary px-4 py-3 dark:border-white/10",
        className,
      )}
    >
      {children}
    </div>
  );
}
