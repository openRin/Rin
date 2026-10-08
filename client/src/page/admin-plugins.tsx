import type { AdminPluginItem, AdminPluginListResponse } from "@rin/api";
import { SettingsBadge, SettingsCard, SettingsCardHeader, Spinner } from "@rin/ui";
import { useCallback, useState } from "react";
import { Helmet } from "react-helmet";
import { useTranslation } from "react-i18next";
import { client } from "../app/runtime";
import { useApiResource } from "../hooks/use-api-resource";
import { useSiteConfig } from "../hooks/useSiteConfig";
import { apiErrorText } from "../utils/api-error";
import { findPluginSettings } from "../plugins/registry";

/**
 * 插件管理页：看状态、开关启停（启停立刻生效，无需重新部署）。
 * 版式照 health.tsx；不渲染 `<h1>`，标题由 AdminLayout 提供。
 */
export function AdminPluginsPage() {
  const { t } = useTranslation();
  const siteConfig = useSiteConfig();
  const [busyName, setBusyName] = useState<string | null>(null);

  const load = useCallback(() => client.adminPlugin.list(), []);
  const { data, loading, error, reload } = useApiResource<AdminPluginListResponse>(load);

  const plugins = data?.plugins ?? [];

  async function toggle(plugin: AdminPluginItem) {
    const nextEnabled = plugin.status !== 'enabled';
    setBusyName(plugin.name);

    const { error: apiError } = await client.adminPlugin.setEnabled(plugin.name, nextEnabled);
    setBusyName(null);

    if (apiError) {
      window.alert(apiErrorText(apiError));
      return;
    }
    await reload();
  }

  const enabledCount = plugins.filter((p) => p.status === 'enabled').length;

  return (
    <div className="flex w-full flex-col gap-4">
      <Helmet>
        <title>{`${t("plugins.title")} - ${siteConfig.name}`}</title>
      </Helmet>

      <div className="flex flex-row items-center justify-between gap-3">
        <span className="text-sm text-neutral-500 dark:text-neutral-400">
          {t("plugins.summary", {
            enabled: enabledCount,
            total: plugins.length,
          })}
        </span>
        {data && (
          <SettingsBadge tone="neutral">
            <code className="text-xs">{data.enabledKey}</code>
          </SettingsBadge>
        )}
      </div>

      {loading && (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      )}

      {error && (
        <SettingsCard tone="danger">
          <SettingsCardHeader
            title={t("plugins.load_failed")}
            description={t("plugins.load_failed_desc")}
          />
        </SettingsCard>
      )}

      {!loading && !error && plugins.length === 0 && (
        <SettingsCard>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            {t("plugins.empty")}
          </p>
        </SettingsCard>
      )}

      {plugins.map((plugin) => (
        <PluginRow
          key={plugin.name}
          plugin={plugin}
          busy={busyName === plugin.name}
          hasSettings={findPluginSettings(plugin.name).length > 0}
          onToggle={() => toggle(plugin)}
        />
      ))}

      <SettingsCard>
        <SettingsCardHeader title={t("plugins.about_title")} description={t("plugins.about_desc")} />
        <ul className="mt-3 flex flex-col gap-1 text-sm text-neutral-500 dark:text-neutral-400">
          <li>· {t("plugins.about_docs")} <code>docs/plugin-system.md</code></li>
          <li>· {t("plugins.about_server")} <code>server/src/plugins/index.ts</code></li>
          <li>· {t("plugins.about_client")} <code>client/src/plugins/index.ts</code></li>
        </ul>
      </SettingsCard>
    </div>
  );
}

function PluginRow({
  plugin,
  busy,
  hasSettings,
  onToggle,
}: {
  plugin: AdminPluginItem;
  busy: boolean;
  /** 该插件是否声明了设置项。没有就不显示「设置」按钮 */
  hasSettings: boolean;
  onToggle: () => void;
}) {
  const { t } = useTranslation();

  const isEnabled = plugin.status === 'enabled';
  const isErrored = plugin.status === 'error';
  // SettingsBadge 没有 danger；出错用 warning 表示「需要关注」
  const tone = isErrored ? 'warning' : isEnabled ? 'success' : 'neutral';

  return (
    <SettingsCard>
      <div className="flex flex-col gap-3">
        <div className="flex flex-row items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex flex-row flex-wrap items-center gap-2">
              <span className="font-medium">{plugin.displayName}</span>
              <code className="text-xs text-neutral-500 dark:text-neutral-400">
                {plugin.name}@{plugin.version}
              </code>
              <SettingsBadge tone={tone}>
                {t(`plugins.status.${plugin.status}`)}
              </SettingsBadge>
            </div>

            {plugin.description && (
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                {plugin.description}
              </p>
            )}
          </div>

          {/* 出错的插件不能切换：它没跑起来，启用也不会自动修好 */}
          <div className="flex shrink-0 flex-row gap-2">
            {hasSettings && (
              <a
                href={`/admin/plugins/${plugin.name}/settings`}
                className="rounded-full border border-black/10 bg-secondary px-4 py-2 text-sm transition-colors hover:bg-w dark:border-white/10"
              >
                {t("plugins.settings.action")}
              </a>
            )}
            <button
              type="button"
              onClick={onToggle}
              disabled={busy || isErrored}
              className="rounded-full border border-black/10 bg-secondary px-4 py-2 text-sm transition-colors hover:bg-w disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10"
            >
              {t(isEnabled ? "plugins.action.disable" : "plugins.action.enable")}
            </button>
          </div>
        </div>

        {/* 扩展点：让管理员一眼看出这个插件能干什么，而不必去读代码 */}
        {plugin.capabilities.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {plugin.capabilities.map((cap) => (
              <SettingsBadge key={cap} tone="neutral">
                <code className="text-xs">{cap}</code>
              </SettingsBadge>
            ))}
          </div>
        )}

        {plugin.apiPrefix && (
          <div className="text-xs text-neutral-500 dark:text-neutral-400">
            {t("plugins.api_prefix")}{' '}
            <code>{plugin.apiPrefix}/</code>
          </div>
        )}

        {isErrored && plugin.error && (
          <div className="rounded-lg bg-red-50 p-3 text-xs text-red-700 dark:bg-red-950 dark:text-red-300">
            {t("plugins.error_reason")} {plugin.error}
          </div>
        )}
      </div>
    </SettingsCard>
  );
}
