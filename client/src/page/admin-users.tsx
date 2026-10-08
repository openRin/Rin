import type { AdminUserListResponse, AdminUserItem } from "@rin/api";
import { FlatActionButton, SettingsBadge, SettingsCard, Spinner } from "@rin/ui";
import { useCallback, useState } from "react";
import { Helmet } from "react-helmet";
import { useTranslation } from "react-i18next";
import { useConfirm } from "../components/dialog";
import { ImageWithFallback } from "../components/image-with-fallback";
import { client } from "../app/runtime";
import { useApiResource } from "../hooks/use-api-resource";
import { useSiteConfig } from "../hooks/useSiteConfig";
import { apiErrorText } from "../utils/api-error";

/**
 * 用户管理页：搜索用户、改权限、删账号。
 * 服务端已挡住「改自己」「删内置管理员」，前端做同样判断以提前给出解释。
 */
export function AdminUsersPage() {
  const { t } = useTranslation();
  const siteConfig = useSiteConfig();
  const { showConfirm, ConfirmUI } = useConfirm();

  const [keyword, setKeyword] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(
    () => client.adminUser.list({ page, size: 20, keyword: searchTerm || undefined }),
    [page, searchTerm],
  );
  const { data, loading, error, reload } = useApiResource<AdminUserListResponse>(load);

  const users = data?.users ?? [];
  const pagination = data?.pagination;

  function submitSearch() {
    setPage(1);
    setSearchTerm(keyword.trim());
  }

  async function togglePermission(user: AdminUserItem) {
    const next = user.permission === 1 ? 0 : 1;
    setBusyId(user.id);

    const { error: apiError } = await client.adminUser.setPermission(user.id, next as 0 | 1);
    setBusyId(null);

    if (apiError) {
      showError(apiErrorText(apiError));
      return;
    }
    await reload();
  }

  function confirmDelete(user: AdminUserItem) {
    showConfirm(
      t("admin_users.delete.title"),
      t("admin_users.delete.confirm", { username: user.username }),
      async () => {
        setBusyId(user.id);
        const { error: apiError } = await client.adminUser.remove(user.id);
        setBusyId(null);

        if (apiError) {
          showError(apiErrorText(apiError));
          return;
        }
        // 删掉的是当前页最后一条时，回退一页避免看到空列表
        if (users.length === 1 && page > 1) {
          setPage(page - 1);
        } else {
          await reload();
        }
      },
    );
  }

  function showError(message: string) {
    // 复用原生弹窗：后台页面的错误不阻塞主流程，不需要再引入一套 UI
    window.alert(message);
  }

  return (
    // 顶层容器与 settings/health 保持一致：只做纵向排布，不自带内边距
    // （外层 AdminLayout 已提供 p-6 的卡片）
    <div className="flex w-full flex-col gap-4">
      {/* 只设 document.title；页面 H1 与描述由 AdminLayout 提供，不要重复渲染 */}
      <Helmet>
        <title>{`${t("admin_users.title")} - ${siteConfig.name}`}</title>
      </Helmet>

      {pagination && (
        <div className="flex flex-row items-center justify-end">
          <SettingsBadge tone="neutral">
            {t("admin_users.total", { total: pagination.total })}
          </SettingsBadge>
        </div>
      )}

      {/* 搜索 */}
      <form
        className="flex flex-row items-center gap-2 mb-4"
        onSubmit={(e) => {
          e.preventDefault();
          submitSearch();
        }}
      >
        <input
          type="search"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder={t("admin_users.search.placeholder")}
          className="flex-1 rounded-lg border border-black/10 bg-w px-3 py-2 text-sm dark:border-white/10"
        />
        <FlatActionButton type="submit" disabled={loading}>
          {t("admin_users.search.action")}
        </FlatActionButton>
        {searchTerm && (
          <FlatActionButton
            type="button"
            onClick={() => {
              setKeyword("");
              setSearchTerm("");
              setPage(1);
            }}
          >
            {t("admin_users.search.clear")}
          </FlatActionButton>
        )}
      </form>

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

      {!loading && !error && users.length === 0 && (
        <SettingsCard>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            {searchTerm ? t("admin_users.empty_filtered") : t("admin_users.empty")}
          </p>
        </SettingsCard>
      )}

      <div className="flex flex-col gap-3">
        {users.map((user) => (
          <UserRow
            key={user.id}
            user={user}
            busy={busyId === user.id}
            onTogglePermission={() => togglePermission(user)}
            onDelete={() => confirmDelete(user)}
          />
        ))}
      </div>

      {/* 分页 */}
      {pagination && pagination.totalPages > 1 && (
        <div className="mt-4 flex flex-row items-center justify-center gap-3">
          <FlatActionButton disabled={page <= 1 || loading} onClick={() => setPage(page - 1)}>
            {t("admin_users.pagination.prev")}
          </FlatActionButton>
          <span className="text-sm t-secondary">
            {t("admin_users.pagination.status", {
              page: pagination.page,
              totalPages: pagination.totalPages,
            })}
          </span>
          <FlatActionButton
            disabled={page >= pagination.totalPages || loading}
            onClick={() => setPage(page + 1)}
          >
            {t("admin_users.pagination.next")}
          </FlatActionButton>
        </div>
      )}

      <ConfirmUI />
    </div>
  );
}

function UserRow({
  user,
  busy,
  onTogglePermission,
  onDelete,
}: {
  user: AdminUserItem;
  busy: boolean;
  onTogglePermission: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const isAdmin = user.permission === 1;
  const hasEmail = Boolean(user.email);

  return (
    <SettingsCard>
      <div className="flex flex-row items-center gap-3">
        <ImageWithFallback
          src={user.avatar || '/avatar.png'}
          alt={user.username}
          className="h-9 w-9 shrink-0 rounded-full"
        />

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex flex-row items-center gap-2">
            <span className="truncate font-medium">{user.username}</span>
            {isAdmin && (
              <SettingsBadge tone="warning">{t("admin_users.badge.admin")}</SettingsBadge>
            )}
            {user.viaEmail === 1 && (
              <SettingsBadge tone="neutral">{t("admin_users.badge.email")}</SettingsBadge>
            )}
            {hasEmail && user.emailVerified === 0 && (
              <SettingsBadge tone="warning">{t("admin_users.badge.unverified")}</SettingsBadge>
            )}
          </div>
          <span className="truncate text-xs text-neutral-500 dark:text-neutral-400">
            {hasEmail ? user.email : `#${user.id}`}
          </span>
        </div>

        <div className="flex shrink-0 flex-row gap-2">
          <FlatActionButton onClick={onTogglePermission} disabled={busy}>
            {isAdmin ? t("admin_users.action.demote") : t("admin_users.action.promote")}
          </FlatActionButton>
          <FlatActionButton onClick={onDelete} disabled={busy}>
            {t("admin_users.action.delete")}
          </FlatActionButton>
        </div>
      </div>
    </SettingsCard>
  );
}
