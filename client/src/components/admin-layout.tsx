import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "wouter";
import { useSiteConfig } from "../hooks/useSiteConfig";

function AdminNavItem({
  href,
  icon,
  label,
}: {
  href: string;
  icon: string;
  label: string;
}) {
  const [location] = useLocation();
  const active = location === href || location.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors ${
        active
          ? "bg-theme text-white"
          : "t-primary hover:bg-neutral-100 dark:hover:bg-white/5"
      }`}
    >
      <i className={`${icon} text-base`} />
      <span>{label}</span>
    </Link>
  );
}

export function AdminLayout({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const siteConfig = useSiteConfig();

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 lg:flex-row lg:px-6">
        <aside className="w-full shrink-0 lg:sticky lg:top-6 lg:w-72 lg:self-start">
          <div className="rounded-2xl border border-black/10 bg-w p-5 dark:border-white/10">
            <Link href="/" className="flex items-center gap-4 rounded-xl px-2 py-2 transition-colors hover:bg-neutral-50 dark:hover:bg-white/5">
              {siteConfig.avatar ? (
                <img src={siteConfig.avatar} alt="Avatar" className="h-12 w-12 rounded-2xl border border-black/10 dark:border-white/10" />
              ) : null}
              <div className="min-w-0">
                <p className="truncate text-base font-semibold t-primary">{siteConfig.name}</p>
                <p className="truncate text-sm text-neutral-500 dark:text-neutral-400">{t("admin.back_to_site")}</p>
              </div>
            </Link>

            <div className="mt-6">
              <p className="px-2 text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400 dark:text-neutral-500">
                {t("admin.title")}
              </p>
              <div className="mt-3 flex flex-col gap-2">
                <AdminNavItem href="/admin/writing" icon="ri-quill-pen-line" label={t("writing")} />
                <AdminNavItem href="/admin/settings" icon="ri-settings-3-line" label={t("settings.title")} />
                <AdminNavItem href="/admin/health" icon="ri-heart-pulse-line" label={t("health.title")} />
                <AdminNavItem href="/admin/queue-status" icon="ri-todo-line" label={t("queue_status.title")} />
                <AdminNavItem href="/admin/compat-tasks" icon="ri-history-line" label={t("compat_tasks.title")} />
              </div>
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <div className="rounded-2xl border border-black/10 bg-w p-6 dark:border-white/10">
            <div className="border-b border-black/5 pb-5 dark:border-white/5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-theme/70">{t("admin.title")}</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em] t-primary">{title}</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-500 dark:text-neutral-400">{description}</p>
            </div>
            <div className="mt-6">{children}</div>
          </div>
        </main>
      </div>
    </div>
  );
}
