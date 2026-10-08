import type { PluginSettingsResponse } from "@rin/api";
import { SettingsBadge, SettingsCard, SettingsCardHeader, Spinner } from "@rin/ui";
import { useCallback, useState } from "react";
import { Helmet } from "react-helmet";
import { useTranslation } from "react-i18next";
import { useLocation, useRoute } from "wouter";
import { PluginSettingsForm } from "../components/plugin-settings-form";
import { client } from "../app/runtime";
import { useApiResource } from "../hooks/use-api-resource";
import { useSiteConfig } from "../hooks/useSiteConfig";
import { findPluginSettings, listFrontendPlugins } from "../plugins/registry";

/**
 * 单个插件的设置页：`/admin/plugins/:name/settings`。
 * 页面不认识任何具体插件 —— 表单完全由插件声明的 `settings` 驱动。
 */
export function AdminPluginSettingsPage() {
  const { t } = useTranslation();
  const siteConfig = useSiteConfig();
  const [, setLocation] = useLocation();
  const [, params] = useRoute<{ name: string }>('/admin/plugins/:name/settings');

  const name = params?.name ?? '';
  const [savedAt, setSavedAt] = useState<number | null>(null);

  // 从前端注册表里查该插件的设置声明
  const declaration = listFrontendPlugins().find((p) => p.manifest.name === name);
  const settings = findPluginSettings(name);

  const load = useCallback(
    () => (name ? client.adminPlugin.getSettings(name) : Promise.resolve({ success: true as const, data: null })),
    [name],
  );
  const { data, loading, error } = useApiResource<PluginSettingsResponse | null>(load);

  if (!name) {
    return <SettingsCard><p className="text-sm">{t('plugins.settings.missing_name')}</p></SettingsCard>;
  }

  if (!declaration) {
    return (
      <SettingsCard tone="warning">
        <SettingsCardHeader
          title={t('plugins.settings.not_found_title')}
          description={t('plugins.settings.not_found_desc', { name })}
        />
        <button
          type="button"
          onClick={() => setLocation('/admin/plugins')}
          className="mt-4 rounded-full border border-black/10 bg-secondary px-4 py-2 text-sm dark:border-white/10"
        >
          {t('plugins.settings.back')}
        </button>
      </SettingsCard>
    );
  }

  return (
    <div className="flex w-full flex-col gap-4">
      <Helmet>
        <title>{`${declaration.manifest.displayName} - ${siteConfig.name}`}</title>
      </Helmet>

      <div className="flex flex-row items-center justify-between gap-3">
        <h1 className="text-lg font-medium">{declaration.manifest.displayName}</h1>
        <SettingsBadge tone="neutral">
          <code className="text-xs">{declaration.manifest.name}</code>
        </SettingsBadge>
      </div>

      {settings.length === 0 ? (
        <SettingsCard>
          <SettingsCardHeader
            title={t('plugins.settings.none_title')}
            description={t('plugins.settings.none_desc')}
          />
        </SettingsCard>
      ) : (
        <SettingsCard>
          {loading && <Spinner />}

          {error && <p className="text-sm text-danger">{t('plugins.settings.load_failed')}</p>}

          {!loading && !error && (
            <PluginSettingsForm
              pluginName={name}
              settings={settings}
              initialValues={data?.values ?? {}}
              onSaved={() => setSavedAt(Date.now())}
            />
          )}

          {savedAt && (
            <p className="mt-3 text-sm text-green-600 dark:text-green-400">
              {t('plugins.settings.saved')}
            </p>
          )}
        </SettingsCard>
      )}
    </div>
  );
}
