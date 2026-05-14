import { SettingsBadge, SettingsCard, SettingsCardBody, SettingsCardHeader } from "@rin/ui";
import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet";
import { useTranslation } from "react-i18next";
import ReactLoading from "react-loading";
import type { QueueStatusItem } from "../api/client";
import { client } from "../app/runtime";
import { Button } from "../components/button";
import { useAlert, useConfirm } from "../components/dialog";
import { useSiteConfig } from "../hooks/useSiteConfig";

function getQueueTone(status: QueueStatusItem["aiSummaryStatus"]) {
  if (status === "failed") return "danger";
  if (status === "completed") return "success";
  if (status === "pending" || status === "processing") return "warning";
  return "default";
}

function QueueStatusEntry({
  item,
  loadingAction,
  onRetry,
  onDelete,
}: {
  item: QueueStatusItem;
  loadingAction?: "retry" | "delete";
  onRetry: (item: QueueStatusItem) => void;
  onDelete: (item: QueueStatusItem) => void;
}) {
  const { t } = useTranslation();
  const canRetry = item.aiSummaryStatus === "failed";
  const canDelete = item.aiSummaryStatus === "failed" || item.aiSummaryStatus === "completed";

  return (
    <SettingsCard tone={getQueueTone(item.aiSummaryStatus)}>
      <SettingsCardHeader
        title={item.title || t("queue_status.untitled")}
        description={t(`queue_status.status.${item.aiSummaryStatus}`)}
        badge={<SettingsBadge tone={item.aiSummaryStatus === "completed" ? "success" : item.aiSummaryStatus === "failed" ? "neutral" : "warning"}>{t(`queue_status.status.${item.aiSummaryStatus}`)}</SettingsBadge>}
      />
      <SettingsCardBody>
        <div className="space-y-2 text-sm text-neutral-600 dark:text-neutral-300">
          <p>{t("queue_status.feed_id", { id: item.id })}</p>
          <p>{t("queue_status.updated_at", { date: new Date(item.updatedAt).toLocaleString() })}</p>
          {item.aiSummaryError ? (
            <p className="whitespace-pre-wrap text-rose-600 dark:text-rose-300">{item.aiSummaryError}</p>
          ) : null}
          {canRetry || canDelete ? (
            <div className="flex flex-wrap gap-2 pt-2">
              {canRetry ? (
                <Button
                  title={loadingAction === "retry" ? t("queue_status.retrying") : t("queue_status.retry")}
                  disabled={loadingAction !== undefined}
                  onClick={() => onRetry(item)}
                />
              ) : null}
              {canDelete ? (
                <Button
                  secondary
                  title={loadingAction === "delete" ? t("queue_status.deleting") : t("queue_status.delete")}
                  disabled={loadingAction !== undefined}
                  onClick={() => onDelete(item)}
                />
              ) : null}
            </div>
          ) : null}
        </div>
      </SettingsCardBody>
    </SettingsCard>
  );
}

export function QueueStatusPage() {
  const { t } = useTranslation();
  const siteConfig = useSiteConfig();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [queueConfigured, setQueueConfigured] = useState(false);
  const [generatedAt, setGeneratedAt] = useState("");
  const [summary, setSummary] = useState<Record<"idle" | "pending" | "processing" | "completed" | "failed", number>>({
    idle: 0,
    pending: 0,
    processing: 0,
    completed: 0,
    failed: 0,
  });
  const [items, setItems] = useState<QueueStatusItem[]>([]);
  const [actingId, setActingId] = useState<number | null>(null);
  const [actingType, setActingType] = useState<"retry" | "delete" | null>(null);
  const { showAlert, AlertUI } = useAlert();
  const { showConfirm, ConfirmUI } = useConfirm();

  const loadQueueStatus = () => {
    setLoading(true);
    setError(null);
    client.config
      .getQueueStatus()
      .then(({ data, error }) => {
        if (error) {
          setError(error.value);
          return;
        }

        if (data) {
          setQueueConfigured(data.queueConfigured);
          setGeneratedAt(data.generatedAt);
          setSummary(data.summary);
          setItems(data.items);
        }
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadQueueStatus();
  }, []);

  const orderedItems = useMemo(() => {
    const score = { failed: 0, processing: 1, pending: 2, completed: 3, idle: 4 } as const;
    return [...items].sort((left, right) => score[left.aiSummaryStatus] - score[right.aiSummaryStatus]);
  }, [items]);

  return (
    <div className="flex w-full flex-col gap-4">
      <Helmet>
        <title>{`${t("queue_status.title")} - ${siteConfig.name}`}</title>
      </Helmet>

      <AlertUI />
      <ConfirmUI />

      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-5">
        <SettingsCard tone={queueConfigured ? "success" : "danger"}>
          <SettingsCardHeader title={queueConfigured ? t("queue_status.configured") : t("queue_status.not_configured")} description={t("queue_status.binding")} />
        </SettingsCard>
        <SettingsCard tone="warning">
          <SettingsCardHeader title={String(summary.pending)} description={t("queue_status.summary.pending")} />
        </SettingsCard>
        <SettingsCard tone="warning">
          <SettingsCardHeader title={String(summary.processing)} description={t("queue_status.summary.processing")} />
        </SettingsCard>
        <SettingsCard tone="success">
          <SettingsCardHeader title={String(summary.completed)} description={t("queue_status.summary.completed")} />
        </SettingsCard>
        <SettingsCard tone="danger">
          <SettingsCardHeader title={String(summary.failed)} description={t("queue_status.summary.failed")} />
        </SettingsCard>
      </div>

      {generatedAt ? (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          {t("queue_status.generated_at", { date: new Date(generatedAt).toLocaleString() })}
        </p>
      ) : null}

      {loading ? (
        <div className="flex items-center gap-3 py-8 text-sm text-neutral-500 dark:text-neutral-400">
          <ReactLoading width="1.25em" height="1.25em" type="spin" color="#FC466B" />
          <span>{t("queue_status.loading")}</span>
        </div>
      ) : null}

      {error ? (
        <SettingsCard tone="danger">
          <SettingsCardHeader title={t("queue_status.load_failed")} description={error} />
        </SettingsCard>
      ) : null}

      {!loading && !error && orderedItems.length === 0 ? (
        <SettingsCard>
          <SettingsCardHeader title={t("queue_status.empty_title")} description={t("queue_status.empty_description")} />
        </SettingsCard>
      ) : null}

      {!loading && !error && orderedItems.length > 0 ? (
        <div className="space-y-4">
          {orderedItems.map((item) => (
            <QueueStatusEntry
              key={`${item.id}-${item.updatedAt}`}
              item={item}
              loadingAction={actingId === item.id ? actingType ?? undefined : undefined}
              onRetry={(entry) => {
                setActingId(entry.id);
                setActingType("retry");
                client.config.retryQueueTask(entry.id).then(({ error }) => {
                  if (error) {
                    showAlert(error.value);
                    return;
                  }
                  showAlert(t("queue_status.retry_success"));
                  loadQueueStatus();
                }).finally(() => {
                  setActingId(null);
                  setActingType(null);
                });
              }}
              onDelete={(entry) => {
                showConfirm(
                  t("queue_status.delete_confirm_title"),
                  t("queue_status.delete_confirm_description", { id: entry.id }),
                  async () => {
                    setActingId(entry.id);
                    setActingType("delete");
                    try {
                      const { error } = await client.config.deleteQueueTask(entry.id);
                      if (error) {
                        showAlert(error.value);
                        return;
                      }
                      showAlert(t("queue_status.delete_success"));
                      loadQueueStatus();
                    } finally {
                      setActingId(null);
                      setActingType(null);
                    }
                  },
                );
              }}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
