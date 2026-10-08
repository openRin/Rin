import type { AdminCommentListResponse, PendingComment } from "@rin/api";
import { FlatActionButton, FlatTabButton, SettingsBadge, SettingsCard, Spinner } from "@rin/ui";
import { useCallback, useState } from "react";
import { Helmet } from "react-helmet";
import { useTranslation } from "react-i18next";
import { useConfirm } from "../components/dialog";
import { client } from "../app/runtime";
import { useApiResource } from "../hooks/use-api-resource";
import { useSiteConfig } from "../hooks/useSiteConfig";
import { timeago } from "../utils/timeago";
import { apiErrorText } from "../utils/api-error";

type Filter = 'pending' | 'approved' | 'all';

/**
 * 评论管理（管理员后台）：tab 切换待审核 / 已通过 / 全部三个视角，
 * 支持通过、驳回、永久删除。
 */
export function CommentModerationPage() {
  const { t } = useTranslation();
  const siteConfig = useSiteConfig();
  const { showConfirm, ConfirmUI } = useConfirm();
  const [filter, setFilter] = useState<Filter>('pending');
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(
    () => client.comment.listComments({ filter, page, size: 20 }),
    [filter, page],
  );
  const { data, loading, error, reload } = useApiResource<AdminCommentListResponse>(load);

  const comments = data?.comments ?? [];
  const pagination = data?.pagination;

  function switchFilter(next: Filter) {
    setFilter(next);
    // 切筛选条件时回到第一页，否则可能停在一个已越界的页码上
    setPage(1);
  }

  async function setApproved(comment: PendingComment, approved: boolean) {
    setBusyId(comment.id);
    const { error: apiError } = await client.comment.setApproved(comment.id, approved);
    setBusyId(null);

    if (apiError) {
      window.alert(apiErrorText(apiError));
      return;
    }

    // 当前页最后一条被移出当前筛选时回退一页，避免显示空列表
    if (comments.length === 1 && page > 1) {
      setPage(page - 1);
    } else {
      await reload();
    }
  }

  function confirmSetApproved(comment: PendingComment, approved: boolean) {
    showConfirm(
      approved ? t("moderation.approve.title") : t("moderation.reject.title"),
      approved
        ? t("moderation.approve.confirm")
        : t("moderation.reject.confirm"),
      () => setApproved(comment, approved),
    );
  }

  // 永久删除：驳回只是 approved 置 0，行还在库里；删除不可撤销，需二次确认
  async function removeComment(comment: PendingComment) {
    setBusyId(comment.id);
    const { error: apiError } = await client.comment.remove(comment.id);
    setBusyId(null);

    if (apiError) {
      window.alert(apiErrorText(apiError));
      return;
    }

    // 删掉的是当前页最后一条时回退一页，避免显示空列表
    if (comments.length === 1 && page > 1) {
      setPage(page - 1);
    } else {
      await reload();
    }
  }

  function confirmRemove(comment: PendingComment) {
    showConfirm(
      t("moderation.delete.title"),
      t("moderation.delete.confirm"),
      () => removeComment(comment),
    );
  }

  const emptyMessage =
    filter === 'pending'
      ? t("moderation.empty")
      : filter === 'approved'
        ? t("moderation.empty_approved")
        : t("moderation.empty_all");

  return (
    // 顶层容器与 settings/health 保持一致：只做纵向排布，不自带内边距
    // （外层 AdminLayout 已提供 p-6 的卡片）
    <div className="flex w-full flex-col gap-4">
      {/* 只设 document.title；页面 H1 与描述由 AdminLayout 提供，不要重复渲染 */}
      <Helmet>
        <title>{`${t("moderation.title")} - ${siteConfig.name}`}</title>
      </Helmet>

      <div className="flex flex-row items-center justify-between gap-3">
        {/* 状态筛选 */}
        <div className="flex flex-row gap-2">
          {(['pending', 'approved', 'all'] as const).map((value) => (
            <FlatTabButton
              key={value}
              active={filter === value}
              onClick={() => switchFilter(value)}
            >
              {t(`moderation.filter.${value}`)}
            </FlatTabButton>
          ))}
        </div>

        {pagination && (
          <SettingsBadge tone={filter === 'pending' && pagination.total > 0 ? 'warning' : 'neutral'}>
            {t("moderation.count", { count: pagination.total })}
          </SettingsBadge>
        )}
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

      {!loading && !error && comments.length === 0 && (
        <SettingsCard>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">{emptyMessage}</p>
        </SettingsCard>
      )}

      <div className="flex flex-col gap-3">
        {comments.map((comment) => (
          <CommentRow
            key={comment.id}
            comment={comment}
            busy={busyId === comment.id}
            onToggle={() => confirmSetApproved(comment, !comment.approved)}
            onDelete={() => confirmRemove(comment)}
          />
        ))}
      </div>

      {/* 分页 */}
      {pagination && pagination.totalPages > 1 && (
        <div className="mt-4 flex flex-row items-center justify-center gap-3">
          <FlatActionButton disabled={page <= 1 || loading} onClick={() => setPage(page - 1)}>
            {t("moderation.pagination.prev")}
          </FlatActionButton>
          <span className="text-sm t-secondary">
            {t("moderation.pagination.status", {
              page: pagination.page,
              totalPages: pagination.totalPages,
            })}
          </span>
          <FlatActionButton
            disabled={page >= pagination.totalPages || loading}
            onClick={() => setPage(page + 1)}
          >
            {t("moderation.pagination.next")}
          </FlatActionButton>
        </div>
      )}

      <ConfirmUI />
    </div>
  );
}

function CommentRow({
  comment,
  busy,
  onToggle,
  onDelete,
}: {
  comment: PendingComment;
  busy: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const authorName = comment.user?.username || comment.guestName || t("anonymous");

  return (
    <SettingsCard>
      <div className="flex flex-col gap-2">
        <div className="flex flex-row items-baseline justify-between gap-3">
          <div className="flex min-w-0 flex-row items-center gap-2">
            <span className="truncate font-medium">{authorName}</span>
            <SettingsBadge tone={comment.approved ? 'success' : 'warning'}>
              {t(comment.approved ? "moderation.badge.approved" : "moderation.badge.pending")}
            </SettingsBadge>
          </div>
          <span className="shrink-0 text-xs text-neutral-500 dark:text-neutral-400">
            {timeago(comment.createdAt)}
          </span>
        </div>

        <p className="break-words [overflow-wrap:anywhere]">{comment.content}</p>

        <div className="flex flex-row items-center justify-between gap-2">
          <span className="truncate text-xs text-neutral-500 dark:text-neutral-400">
            {t("moderation.on_feed", { title: comment.feedTitle || `#${comment.feedId}` })}
          </span>

          <div className="flex shrink-0 flex-row gap-2">
            {comment.approved && (
              <a
                href={`/feed/${comment.feedId}#comment-${comment.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border border-black/10 bg-secondary px-4 py-2 text-sm dark:border-white/10"
              >
                {t("moderation.view")}
              </a>
            )}
            <FlatActionButton onClick={onToggle} disabled={busy}>
              {t(comment.approved ? "moderation.reject.action" : "moderation.approve.action")}
            </FlatActionButton>
            {/* 删除是唯一真正释放数据库空间的手段，单独放在最后 */}
            <FlatActionButton onClick={onDelete} disabled={busy}>
              {t("moderation.delete.action")}
            </FlatActionButton>
          </div>
        </div>
      </div>
    </SettingsCard>
  );
}
