import type { AdminArticleItem, AdminArticleListResponse } from "../api/client";
import { FlatActionButton, SettingsBadge, SettingsCard, Spinner } from "@rin/ui";
import { useCallback, useMemo, useState } from "react";
import { Helmet } from "react-helmet";
import { useTranslation } from "react-i18next";
import { useConfirm } from "../components/dialog";
import { client } from "../app/runtime";
import { useApiResource } from "../hooks/use-api-resource";
import { useSiteConfig } from "../hooks/useSiteConfig";
import { apiErrorText } from "../utils/api-error";

/**
 * 文章统一管理页：管理员查看全站文章（含草稿/未列出）、搜索、批量删除。
 * 版式照 admin-users.tsx；不渲染 `<h1>`，标题由 AdminLayout 提供。
 */
export function AdminArticlesPage() {
  const { t } = useTranslation();
  const siteConfig = useSiteConfig();
  const { showConfirm, ConfirmUI } = useConfirm();

  const [keyword, setKeyword] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(
    () => client.adminFeeds.list({ page, size: 20, keyword: searchTerm || undefined }),
    [page, searchTerm],
  );
  const { data, loading, error, reload } = useApiResource<AdminArticleListResponse>(load);

  const articles = data?.feeds ?? [];
  const pagination = data?.pagination;

  // 可选中的行：仅当前页。翻页/搜索后旧选择自动失效
  const pageIds = useMemo(() => articles.map((a) => a.id), [articles]);
  const selectedCount = pageIds.filter((id) => selectedIds.has(id)).length;
  const allSelected = pageIds.length > 0 && selectedCount === pageIds.length;

  function submitSearch() {
    setPage(1);
    setSelectedIds(new Set());
    setSearchTerm(keyword.trim());
  }

  function toggleSelect(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleSelectAll() {
    setSelectedIds((current) => {
      if (pageIds.length > 0 && pageIds.every((id) => current.has(id))) {
        return new Set();
      }
      return new Set(pageIds);
    });
  }

  function confirmBatchDelete() {
    const ids = pageIds.filter((id) => selectedIds.has(id));
    if (ids.length === 0) return;

    showConfirm(
      t("admin_articles.batch_delete.title"),
      t("admin_articles.batch_delete.confirm", { count: ids.length }),
      async () => {
        setBusy(true);
        const { error: apiError, data: result } = await client.adminFeeds.batchDelete(ids);
        setBusy(false);

        if (apiError) {
          window.alert(apiErrorText(apiError));
          return;
        }

        if (result && result.missing.length > 0) {
          window.alert(t("admin_articles.batch_delete.missing", {
            count: result.deleted,
            ids: result.missing.join(", "),
          }));
        }

        setSelectedIds(new Set());
        // 删掉的是当前页全部数据时，回退一页避免看到空列表
        if (articles.length === ids.length && page > 1) {
          setPage(page - 1);
        } else {
          await reload();
        }
      },
    );
  }

  return (
    // 顶层容器与 settings/health 保持一致：只做纵向排布，不自带内边距
    // （外层 AdminLayout 已提供 p-6 的卡片）
    <div className="flex w-full flex-col gap-4">
      {/* 只设 document.title；页面 H1 与描述由 AdminLayout 提供，不要重复渲染 */}
      <Helmet>
        <title>{`${t("admin_articles.title")} - ${siteConfig.name}`}</title>
      </Helmet>

      {pagination && (
        <div className="flex flex-row items-center justify-between gap-3">
          <FlatActionButton onClick={toggleSelectAll} disabled={loading || pageIds.length === 0}>
            {allSelected ? t("admin_articles.select.none") : t("admin_articles.select.all")}
          </FlatActionButton>
          <SettingsBadge tone="neutral">
            {t("admin_articles.total", { total: pagination.total })}
          </SettingsBadge>
        </div>
      )}

      {/* 搜索 */}
      <form
        className="flex flex-row items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          submitSearch();
        }}
      >
        <input
          type="search"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder={t("admin_articles.search.placeholder")}
          className="flex-1 rounded-lg border border-black/10 bg-w px-3 py-2 text-sm dark:border-white/10"
        />
        <FlatActionButton type="submit" disabled={loading}>
          {t("admin_articles.search.action")}
        </FlatActionButton>
        {searchTerm && (
          <FlatActionButton
            type="button"
            onClick={() => {
              setKeyword("");
              setSearchTerm("");
              setPage(1);
              setSelectedIds(new Set());
            }}
          >
            {t("admin_articles.search.clear")}
          </FlatActionButton>
        )}
      </form>

      {/* 批量删除：选中后才可用 */}
      <div className="flex flex-row items-center justify-end gap-2">
        <span className="text-sm text-neutral-500 dark:text-neutral-400">
          {t("admin_articles.selected", { count: selectedCount })}
        </span>
        <FlatActionButton
          onClick={confirmBatchDelete}
          disabled={busy || selectedCount === 0}
        >
          {t("admin_articles.batch_delete.action")}
        </FlatActionButton>
      </div>

      {loading && (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      )}

      {error && (
        <SettingsCard>
          <p className="text-sm text-danger">{apiErrorText({ value: error })}</p>
        </SettingsCard>
      )}

      {!loading && !error && articles.length === 0 && (
        <SettingsCard>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            {searchTerm ? t("admin_articles.empty_filtered") : t("admin_articles.empty")}
          </p>
        </SettingsCard>
      )}

      <div className="flex flex-col gap-3">
        {articles.map((article) => (
          <ArticleRow
            key={article.id}
            article={article}
            selected={selectedIds.has(article.id)}
            expanded={expandedId === article.id}
            busy={busy}
            onToggleSelect={() => toggleSelect(article.id)}
            onToggleExpand={() => setExpandedId(expandedId === article.id ? null : article.id)}
          />
        ))}
      </div>

      {/* 分页 */}
      {pagination && pagination.totalPages > 1 && (
        <div className="mt-4 flex flex-row items-center justify-center gap-3">
          <FlatActionButton disabled={page <= 1 || loading} onClick={() => setPage(page - 1)}>
            {t("admin_articles.pagination.prev")}
          </FlatActionButton>
          <span className="text-sm t-secondary">
            {t("admin_articles.pagination.status", {
              page: pagination.page,
              totalPages: pagination.totalPages,
            })}
          </span>
          <FlatActionButton
            disabled={page >= pagination.totalPages || loading}
            onClick={() => setPage(page + 1)}
          >
            {t("admin_articles.pagination.next")}
          </FlatActionButton>
        </div>
      )}

      <ConfirmUI />
    </div>
  );
}

function ArticleRow({
  article,
  selected,
  expanded,
  busy,
  onToggleSelect,
  onToggleExpand,
}: {
  article: AdminArticleItem;
  selected: boolean;
  expanded: boolean;
  busy: boolean;
  onToggleSelect: () => void;
  onToggleExpand: () => void;
}) {
  const { t } = useTranslation();

  // 状态优先级：草稿 > 未列出 > 已发布
  const statusKey = article.draft === 1
    ? "draft"
    : article.listed !== 1
      ? "unlisted"
      : "published";

  return (
    <SettingsCard>
      <div className="flex flex-row items-start gap-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelect}
          disabled={busy}
          aria-label={t("admin_articles.select.row", { title: article.title ?? article.id })}
          className="mt-1 h-4 w-4 shrink-0 accent-theme"
        />

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-row flex-wrap items-center gap-2">
            <span className="truncate font-medium">{article.title || t("admin_articles.untitled")}</span>
            <SettingsBadge tone={statusKey === "published" ? "success" : statusKey === "draft" ? "warning" : "neutral"}>
              {t(`admin_articles.status.${statusKey}`)}
            </SettingsBadge>
            {article.top === 1 && (
              <SettingsBadge tone="neutral">{t("admin_articles.top")}</SettingsBadge>
            )}
          </div>

          <div className="flex flex-row flex-wrap gap-x-4 text-xs text-neutral-500 dark:text-neutral-400">
            <span className="max-w-full truncate">
              {t("admin_articles.fields.id")} <code>{article.id}</code>
            </span>
            <span>
              {t("admin_articles.fields.created_at")} {new Date(article.createdAt).toLocaleString()}
            </span>
            <span>
              {t("admin_articles.fields.comments")} {article.commentCount}
            </span>
            <span>
              {t("admin_articles.fields.pv")} {article.pv}
            </span>
          </div>

          {expanded && (
            <div className="mt-2 flex flex-col gap-1 rounded-lg bg-neutral-50 p-3 text-sm dark:bg-white/5">
              <div>
                <span className="text-neutral-500 dark:text-neutral-400">
                  {t("admin_articles.fields.alias")}
                </span>{" "}
                <code>{article.alias || "-"}</code>
              </div>
              <div>
                <span className="text-neutral-500 dark:text-neutral-400">
                  {t("admin_articles.fields.updated_at")}
                </span>{" "}
                {new Date(article.updatedAt).toLocaleString()}
              </div>
              <p className="whitespace-pre-wrap break-words text-neutral-600 dark:text-neutral-300">
                {article.summary || t("admin_articles.no_summary")}
              </p>
            </div>
          )}
        </div>

        <div className="flex shrink-0 flex-row gap-2">
          <FlatActionButton onClick={onToggleExpand}>
            {expanded ? t("admin_articles.action.collapse") : t("admin_articles.action.view")}
          </FlatActionButton>
        </div>
      </div>
    </SettingsCard>
  );
}
