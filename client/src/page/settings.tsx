import { SettingsBadge, SettingsCard, SettingsCardHeader, SettingsCardRow } from "@rin/ui";
import { type ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { Helmet } from "react-helmet";
import { useTranslation } from "react-i18next";
import ReactLoading from "react-loading";
import Modal from "react-modal";
import { client, oauth_url } from "../app/runtime";
import { Button } from "../components/button";
import { useAlert } from "../components/dialog.tsx";
import { useSiteConfig } from "../hooks/useSiteConfig";
import { AISummarySettings } from "./settings-ai";
import { ItemButton, ItemInput, ItemSwitch, ItemTitle, ItemWithUpload } from "./settings-items";
import {
  areSettingsDraftsEqual,
  buildAIConfigDraftValue,
  createSettingsConfigWrappers,
  importWordPressFile,
  loadSettingsConfigState,
  mergeSessionConfig,
  saveSettingsConfigState,
  type SettingsDraft,
  updateDraftConfig,
  uploadFavicon,
} from "./settings-helpers";

import "../utils/thumb.css";

export function Settings() {
  const { t } = useTranslation();
  const siteConfig = useSiteConfig();
  const [isOpen, setIsOpen] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgList, setMsgList] = useState<{ title: string; reason: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<SettingsDraft>({ clientConfig: {}, serverConfig: {} });
  const [initialDraft, setInitialDraft] = useState<SettingsDraft>({ clientConfig: {}, serverConfig: {} });
  const [hasStoredAiApiKey, setHasStoredAiApiKey] = useState(false);
  const ref = useRef(false);
  const { showAlert, AlertUI } = useAlert();

  useEffect(() => {
    if (ref.current) return;
    loadSettingsConfigState()
      .then((state) => {
        setDraft(state.draft);
        setInitialDraft(state.draft);
        setHasStoredAiApiKey(state.hasStoredAiApiKey);
        mergeSessionConfig(state.draft.clientConfig);
      })
      .catch((err: any) => {
        showAlert(t("settings.get_config_failed$message", { message: err.message }));
      })
      .finally(() => {
        setLoading(false);
      });
    ref.current = true;
  }, [showAlert, t]);

  const { clientConfig, serverConfig } = useMemo(() => createSettingsConfigWrappers(draft), [draft]);
  const aiValue = useMemo(() => buildAIConfigDraftValue(draft, hasStoredAiApiKey), [draft, hasStoredAiApiKey]);
  const hasUnsavedChanges = !areSettingsDraftsEqual(draft, initialDraft);

  function setConfigValue(type: "client" | "server", key: string, value: unknown) {
    setDraft((current) => updateDraftConfig(current, type, key, value));
  }

  function handleReset() {
    setDraft(initialDraft);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const state = await saveSettingsConfigState(draft);
      setDraft(state.draft);
      setInitialDraft(state.draft);
      setHasStoredAiApiKey(state.hasStoredAiApiKey || aiValue.apiKey.trim().length > 0);
      mergeSessionConfig(state.draft.clientConfig);
      window.dispatchEvent(new Event("storage"));
      showAlert(t("settings.ai_summary.save_success"));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      showAlert(t("settings.update_failed$message", { message }));
    } finally {
      setSaving(false);
    }
  }

  async function handleFaviconChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      await uploadFavicon(file, t, showAlert);
    }
  }

  async function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      const { data, error } = await importWordPressFile(file);
      if (data) {
        setMsg(t("settings.import_success$success$skipped", { success: data.imported, skipped: 0 }));
        setMsgList([]);
        setIsOpen(true);
      } else if (error) {
        showAlert(t("settings.import_failed$message", { message: error.value }));
      }
    }
  }

  return (
    <div className="flex w-full flex-col">
      <Helmet>
        <title>{`${t("settings.title")} - ${siteConfig.name}`}</title>
      </Helmet>
      <main className="w-full rounded-2xl bg-w" aria-label={t("main_content")}>
        <div className="flex flex-col items-start space-y-2">
          {(loading || saving) && <ReactLoading width="1em" height="1em" type="spin" color="#FC466B" />}
          <ItemTitle title={t("settings.friend.title")} />
          <ItemSwitch
            title={t("settings.friend.apply.title")}
            description={t("settings.friend.apply.desc")}
            checked={Boolean(clientConfig.get("friend_apply_enable"))}
            onChange={(checked) => {
              setConfigValue("client", "friend_apply_enable", checked);
            }}
          />
          <ItemSwitch
            title={t("settings.friend.health.title")}
            description={t("settings.friend.health.desc")}
            checked={Boolean(serverConfig.get("friend_crontab"))}
            onChange={(checked) => {
              setConfigValue("server", "friend_crontab", checked);
            }}
          />
          <ItemInput
            title={t("settings.friend.health.ua.title")}
            description={t("settings.friend.health.ua.desc")}
            configKeyTitle="User-Agent"
            value={String(serverConfig.get("friend_ua") ?? "")}
            placeholder={String(serverConfig.default("friend_ua") ?? "User-Agent")}
            onChange={(value) => {
              setConfigValue("server", "friend_ua", value);
            }}
          />

          <ItemTitle title={t("settings.site.title")} />
          <ItemInput
            title={t("settings.site.name.title")}
            description={t("settings.site.name.desc")}
            configKeyTitle={t("settings.site.name.label")}
            value={String(clientConfig.get("site.name") ?? "")}
            placeholder={String(clientConfig.default("site.name") ?? t("settings.site.name.label"))}
            onChange={(value) => {
              setConfigValue("client", "site.name", value);
            }}
          />
          <ItemInput
            title={t("settings.site.description.title")}
            description={t("settings.site.description.desc")}
            configKeyTitle={t("settings.site.description.label")}
            value={String(clientConfig.get("site.description") ?? "")}
            placeholder={String(clientConfig.default("site.description") ?? t("settings.site.description.label"))}
            onChange={(value) => {
              setConfigValue("client", "site.description", value);
            }}
          />
          <ItemInput
            title={t("settings.site.avatar.title")}
            description={t("settings.site.avatar.desc")}
            configKeyTitle={t("settings.site.avatar.label")}
            value={String(clientConfig.get("site.avatar") ?? "")}
            placeholder={String(clientConfig.default("site.avatar") ?? t("settings.site.avatar.label"))}
            onChange={(value) => {
              setConfigValue("client", "site.avatar", value);
            }}
          />
          <ItemInput
            title={t("settings.site.page_size.title")}
            description={t("settings.site.page_size.desc")}
            configKeyTitle={t("settings.site.page_size.label")}
            value={String(clientConfig.get("site.page_size") ?? "")}
            placeholder={String(clientConfig.default("site.page_size") ?? t("settings.site.page_size.label"))}
            onChange={(value) => {
              setConfigValue("client", "site.page_size", value);
            }}
          />

          <ItemTitle title={t("settings.other.title")} />
          <ItemSwitch
            title={t("settings.login.enable.title")}
            description={t("settings.login.enable.desc", { url: oauth_url })}
            checked={Boolean(clientConfig.get("login.enabled"))}
            onChange={(checked) => {
              setConfigValue("client", "login.enabled", checked);
            }}
          />
          <ItemSwitch
            title={t("settings.comment.enable.title")}
            description={t("settings.comment.enable.desc")}
            checked={Boolean(clientConfig.get("comment.enabled"))}
            onChange={(checked) => {
              setConfigValue("client", "comment.enabled", checked);
            }}
          />
          <ItemSwitch
            title={t("settings.counter.enable.title")}
            description={t("settings.counter.enable.desc")}
            checked={Boolean(clientConfig.get("counter.enabled"))}
            onChange={(checked) => {
              setConfigValue("client", "counter.enabled", checked);
            }}
          />
          <ItemSwitch
            title={t("settings.rss.title")}
            description={t("settings.rss.desc")}
            checked={Boolean(clientConfig.get("rss"))}
            onChange={(checked) => {
              setConfigValue("client", "rss", checked);
            }}
          />
          <ItemWithUpload
            title={t("settings.favicon.title")}
            description={t("settings.favicon.desc")}
            accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml"
            onFileChange={handleFaviconChange}
          />
          <ItemInput
            title={t("settings.footer.title")}
            description={t("settings.footer.desc")}
            configKeyTitle="Footer HTML"
            value={String(clientConfig.get("footer") ?? "")}
            onChange={(value) => {
              setConfigValue("client", "footer", value);
            }}
          />
          <ItemButton
            title={t("settings.cache.clear.title")}
            description={t("settings.cache.clear.desc")}
            buttonTitle={t("clear")}
            onConfirm={async () => {
              await client.config.clearCache().then(({ error }) => {
                if (error) {
                  showAlert(t("settings.cache.clear_failed$message", { message: error.value }));
                }
              });
            }}
            alertTitle={t("settings.cache.clear.confirm.title")}
            alertDescription={t("settings.cache.clear.confirm.desc")}
          />
          <ItemWithUpload
            title={t("settings.wordpress.title")}
            description={t("settings.wordpress.desc")}
            accept="application/xml"
            onFileChange={onFileChange}
          />

          <AISummarySettings
            value={aiValue}
            onChange={(updates) => {
              if (updates.enabled !== undefined) {
                setConfigValue("server", "ai_summary.enabled", updates.enabled);
              }
              if (updates.provider !== undefined) {
                setConfigValue("server", "ai_summary.provider", updates.provider);
              }
              if (updates.model !== undefined) {
                setConfigValue("server", "ai_summary.model", updates.model);
              }
              if (updates.apiUrl !== undefined) {
                setConfigValue("server", "ai_summary.api_url", updates.apiUrl);
              }
              if (updates.apiKey !== undefined) {
                setConfigValue("server", "ai_summary.api_key", updates.apiKey);
              }
            }}
          />

          {hasUnsavedChanges && (
            <div className="sticky bottom-4 z-20 mt-6 w-full pb-2">
              <SettingsCard tone="warning">
              <SettingsCardRow
                header={
                  <SettingsCardHeader
                    title={t("settings.ai_summary.save.title")}
                    description={t("settings.ai_summary.unsaved_changes")}
                    badge={<SettingsBadge tone="warning">{t("settings.ai_summary.unsaved_changes")}</SettingsBadge>}
                  />
                }
                action={
                  <>
                    <Button secondary title={t("reset")} onClick={handleReset} disabled={saving} />
                    <Button title={t("save")} onClick={handleSave} disabled={saving || loading} />
                  </>
                }
              />
              </SettingsCard>
            </div>
          )}
        </div>
      </main>

      <Modal
        isOpen={isOpen}
        style={{
          content: {
            top: "50%",
            left: "50%",
            right: "auto",
            bottom: "auto",
            marginRight: "-50%",
            transform: "translate(-50%, -50%)",
            padding: "0",
            border: "none",
            borderRadius: "16px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            background: "transparent",
          },
          overlay: {
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            zIndex: 1000,
          },
        }}
      >
        <div className="flex flex-col items-start bg-w p-4">
          <h1 className="text-2xl font-bold t-primary">{t("settings.import_result")}</h1>
          <p className="text-base dark:text-white">{msg}</p>
          <div className="flex w-full flex-col items-start">
            <p className="mt-2 text-base font-bold dark:text-white">{t("settings.import_skipped")}</p>
            <ul className="flex max-h-64 w-full flex-col items-start overflow-auto">
              {msgList.map((item, idx) => (
                <p key={idx} className="text-sm dark:text-white">
                  {t("settings.import_skipped_item$title$reason", { title: item.title, reason: item.reason })}
                </p>
              ))}
            </ul>
          </div>
          <div className="mt-4 flex w-full flex-col items-center">
            <button
              onClick={() => {
                setIsOpen(false);
              }}
              className="h-min rounded-xl bg-theme px-8 py-2 text-white"
            >
              {t("close")}
            </button>
          </div>
        </div>
      </Modal>
      <AlertUI />
    </div>
  );
}
