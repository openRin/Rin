import { SearchableSelect, SettingsBadge, SettingsCard, SettingsCardBody, SettingsCardHeader } from "@rin/ui";
import type { ApiKeyRecord } from "@rin/api";
import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet";
import { useTranslation } from "react-i18next";
import ReactLoading from "react-loading";
import { client } from "../app/runtime";
import { Button } from "../components/button";
import { useAlert, useConfirm } from "../components/dialog";
import { useSiteConfig } from "../hooks/useSiteConfig";

type ExpiryOption = "never" | "7d" | "14d" | "30d" | "90d" | "180d" | "365d";

const EXPIRY_OPTIONS: Array<{ value: ExpiryOption; labelKey: string }> = [
  { value: "never", labelKey: "api_keys.expiry.never" },
  { value: "7d", labelKey: "api_keys.expiry.7d" },
  { value: "14d", labelKey: "api_keys.expiry.14d" },
  { value: "30d", labelKey: "api_keys.expiry.30d" },
  { value: "90d", labelKey: "api_keys.expiry.90d" },
  { value: "180d", labelKey: "api_keys.expiry.180d" },
  { value: "365d", labelKey: "api_keys.expiry.365d" },
];

function buildExpiryDate(option: ExpiryOption) {
  if (option === "never") {
    return null;
  }

  const now = new Date();
  const days = option === "7d" ? 7 : option === "14d" ? 14 : option === "30d" ? 30 : option === "90d" ? 90 : option === "180d" ? 180 : 365;
  now.setDate(now.getDate() + days);
  return now.toISOString();
}

function formatDate(value: string | null, t: ReturnType<typeof useTranslation>["t"]) {
  if (!value) {
    return t("api_keys.never");
  }

  return new Date(value).toLocaleString();
}

export function ApiKeysPage() {
  const { t } = useTranslation();
  const siteConfig = useSiteConfig();
  const { showAlert, AlertUI } = useAlert();
  const { showConfirm, ConfirmUI } = useConfirm();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [items, setItems] = useState<ApiKeyRecord[]>([]);
  const [name, setName] = useState("");
  const [expiry, setExpiry] = useState<ExpiryOption>("never");
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);

  const skillUrl = useMemo(() => {
    if (typeof window === "undefined") {
      return "/skills/rin-agent/SKILL.md";
    }

    return new URL("/skills/rin-agent/SKILL.md", window.location.origin).toString();
  }, []);

  const apiBaseUrl = useMemo(() => {
    if (typeof window === "undefined") {
      return "";
    }

    return window.location.origin;
  }, []);

  async function loadApiKeys() {
    setLoading(true);
    try {
      const { data, error } = await client.apiKeys.list();
      if (error) {
        throw new Error(error.value);
      }
      setItems(data?.items ?? []);
    } catch (error) {
      showAlert(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadApiKeys();
  }, []);

  async function handleCreate() {
    if (!name.trim()) {
      showAlert(t("api_keys.errors.name_required"));
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await client.apiKeys.create({
        name: name.trim(),
        expiresAt: buildExpiryDate(expiry),
      });

      if (error || !data) {
        throw new Error(error?.value ?? t("api_keys.errors.create_failed"));
      }

      setCreatedSecret(data.secret);
      setItems((current) => [data.apiKey, ...current]);
      setName("");
      setExpiry("never");
    } catch (error) {
      showAlert(error instanceof Error ? error.message : String(error));
    } finally {
      setSubmitting(false);
    }
  }

  async function copyText(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      showAlert(t("api_keys.copied"));
    } catch (error) {
      showAlert(error instanceof Error ? error.message : String(error));
    }
  }

  async function handleRevoke(id: number) {
    const { error } = await client.apiKeys.revoke(id);
    if (error) {
      throw new Error(error.value);
    }

    setItems((current) =>
      current.map((item) =>
        item.id === id
          ? {
              ...item,
              revokedAt: new Date().toISOString(),
            }
          : item,
      ),
    );
  }

  const exampleToken = createdSecret ?? "rin_your_api_key_here";
  const curlExample = [
    `curl -X POST '${apiBaseUrl}/api/feed' \\`,
    `  -H 'Authorization: Bearer ${exampleToken}' \\`,
    `  -H 'Content-Type: application/json' \\`,
    `  -d '{"title":"Agent draft","content":"# Hello from Rin","summary":"Created by an external agent","draft":true,"listed":false,"tags":[]}'`,
  ].join("\n");

  return (
    <div className="flex w-full flex-col gap-4">
      <Helmet>
        <title>{`${t("api_keys.title")} - ${siteConfig.name}`}</title>
      </Helmet>

      <SettingsCard>
        <SettingsCardHeader title={t("api_keys.create.title")} description={t("api_keys.create.description")} />
        <SettingsCardBody>
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px_auto]">
            <label className="flex flex-col gap-2 text-sm t-primary">
              <span>{t("api_keys.create.name_label")}</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={t("api_keys.create.name_placeholder")}
                className="rounded-xl border border-black/10 bg-w px-4 py-3 outline-none focus:border-black/20 dark:border-white/10 dark:focus:border-white/20"
              />
            </label>
            <label className="flex min-w-0 flex-col gap-2 text-sm t-primary">
              <span>{t("api_keys.create.expiry_label")}</span>
              <div className="min-w-0 [&>div]:min-w-0">
                <SearchableSelect
                value={expiry}
                onChange={(value) => setExpiry(value as ExpiryOption)}
                options={EXPIRY_OPTIONS.map((option) => ({
                  value: option.value,
                  label: t(option.labelKey),
                }))}
                placeholder={t("api_keys.create.expiry_label")}
                emptyLabel={t("api_keys.empty")}
                searchable={false}
              />
              </div>
            </label>
            <div className="flex items-end">
              <Button title={submitting ? t("api_keys.create.creating") : t("api_keys.create.submit")} onClick={() => void handleCreate()} />
            </div>
          </div>
        </SettingsCardBody>
      </SettingsCard>

      {createdSecret ? (
        <SettingsCard tone="warning">
          <SettingsCardHeader title={t("api_keys.secret.title")} description={t("api_keys.secret.description")} />
          <SettingsCardBody>
            <div className="flex min-w-0 flex-col gap-3">
              <code className="block overflow-x-auto break-all rounded-xl bg-black px-4 py-3 text-sm text-white">{createdSecret}</code>
              <div className="flex flex-wrap gap-3">
                <Button title={t("api_keys.secret.copy")} onClick={() => void copyText(createdSecret)} />
                <Button secondary title={t("api_keys.secret.dismiss")} onClick={() => setCreatedSecret(null)} />
              </div>
            </div>
          </SettingsCardBody>
        </SettingsCard>
      ) : null}

      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="min-w-0 space-y-4">
          <SettingsCard>
            <SettingsCardHeader title={t("api_keys.list.title")} description={t("api_keys.list.description")} />
            <SettingsCardBody>
              {loading ? (
                <div className="flex items-center gap-3 py-4 text-sm text-neutral-500 dark:text-neutral-400">
                  <ReactLoading width="1.25em" height="1.25em" type="spin" color="#FC466B" />
                  <span>{t("api_keys.loading")}</span>
                </div>
              ) : null}

              {!loading && items.length === 0 ? <p className="text-sm text-neutral-500 dark:text-neutral-400">{t("api_keys.empty")}</p> : null}

              {!loading && items.length > 0 ? (
                <div className="space-y-3">
                  {items.map((item) => (
                    <SettingsCard key={item.id} tone={item.revokedAt ? "warning" : "default"}>
                      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div className="min-w-0 flex-1">
                          <SettingsCardHeader
                            title={item.name}
                            description={`${item.keyPrefix}...`}
                            badge={
                              <SettingsBadge tone={item.revokedAt ? "neutral" : "success"}>
                                {item.revokedAt ? t("api_keys.status.revoked") : t("api_keys.status.active")}
                              </SettingsBadge>
                            }
                          />
                        </div>
                        {item.revokedAt ? null : (
                          <div className="flex shrink-0 flex-wrap items-center gap-3 md:justify-end">
                            <Button
                              secondary
                              title={t("api_keys.revoke")}
                              onClick={() => {
                                showConfirm(
                                  t("api_keys.revoke_confirm.title"),
                                  t("api_keys.revoke_confirm.description", { name: item.name }),
                                  () => handleRevoke(item.id),
                                );
                              }}
                            />
                          </div>
                        )}
                      </div>
                      <SettingsCardBody>
                        <div className="grid gap-2 text-sm text-neutral-600 dark:text-neutral-300 md:grid-cols-2">
                          <p className="break-words">{t("api_keys.fields.created_at", { date: formatDate(item.createdAt, t) })}</p>
                          <p className="break-words">{t("api_keys.fields.last_used_at", { date: formatDate(item.lastUsedAt, t) })}</p>
                          <p className="break-words">{t("api_keys.fields.expires_at", { date: formatDate(item.expiresAt, t) })}</p>
                          <p className="break-words">{t("api_keys.fields.capabilities", { scopes: item.scopes.join(", ") })}</p>
                        </div>
                      </SettingsCardBody>
                    </SettingsCard>
                  ))}
                </div>
              ) : null}
            </SettingsCardBody>
          </SettingsCard>
        </div>

        <div className="min-w-0 space-y-4">
          <SettingsCard>
            <SettingsCardHeader title={t("api_keys.docs.title")} description={t("api_keys.docs.description")} />
            <SettingsCardBody>
              <div className="space-y-3 text-sm text-neutral-600 dark:text-neutral-300">
                <p>{t("api_keys.docs.scope_note")}</p>
                <p>{t("api_keys.docs.routes_note")}</p>
                <pre className="min-w-0 max-w-full overflow-x-auto whitespace-pre-wrap break-all rounded-xl bg-black px-4 py-3 text-xs text-white">
                  <code className="break-all">{curlExample}</code>
                </pre>
                <div className="flex flex-wrap gap-3">
                  <Button title={t("api_keys.docs.copy_curl")} onClick={() => void copyText(curlExample)} />
                  <a
                    href={skillUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center rounded-xl border border-black/10 px-4 py-2 text-sm font-medium t-primary transition-colors hover:bg-neutral-100 dark:border-white/10 dark:hover:bg-white/5"
                  >
                    {t("api_keys.docs.open_skill")}
                  </a>
                </div>
              </div>
            </SettingsCardBody>
          </SettingsCard>
        </div>
      </div>

      <AlertUI />
      <ConfirmUI />
    </div>
  );
}
