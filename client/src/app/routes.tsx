import type { ReactNode } from "react";
import { useContext } from "react";
import type { DefaultParams, PathPattern } from "wouter";
import { Route, Switch, useLocation } from "wouter";
import { AdminLayout } from "../components/admin-layout";
import Footer from "../components/footer";
import { Header } from "../components/header";
import { Padding } from "../components/padding";
import { getHeaderLayoutDefinition } from "../components/site-header/layout-registry";
import { Tips, TipsPage } from "../components/tips";
import useTableOfContents from "../hooks/useTableOfContents";
import { useSiteConfig } from "../hooks/useSiteConfig";
import { CallbackPage } from "../page/callback";
import { CompatTasksPage } from "../page/compat-tasks";
import { AdminPluginSettingsPage } from "../page/admin-plugin-settings";
import { AdminPluginsPage } from "../page/admin-plugins";
import { AdminArticlesPage } from "../page/admin-articles";
import { AdminUsersPage } from "../page/admin-users";
import { CommentModerationPage } from "../page/comment-moderation";
import { ErrorPage } from "../page/error";
import { FeedPage, TOCHeader } from "../page/feed";
import { FeedsPage } from "../page/feeds";
import { FriendsPage } from "../page/friends";
import { HealthPage } from "../page/health";
import { HashtagPage } from "../page/hashtag";
import { HashtagsPage } from "../page/hashtags";
import { LoginPage } from "../page/login";
import { MomentsPage } from "../page/moments";
import { ProfilePage } from "../page/profile";
import { QueueStatusPage } from "../page/queue-status";
import { RegisterPage } from "../page/register";
import { SearchPage } from "../page/search";
import { Settings } from "../page/settings";
import { TimelinePage } from "../page/timeline";
import { WritingPage } from "../page/writing";
import { ProfileContext } from "../state/profile";
import { listPluginPages, type PluginPage } from "../plugins/registry";
// 副作用导入：执行注册，把插件页面注入下面的路由表。
// 入口是 src/plugins/index.ts（client/plugins/ 下没有 index，导入目录会解析失败）。
import "../plugins";
import { tryInt } from "../utils/int";
import { useTranslation } from "react-i18next";

export function AppRoutes() {
  const { t } = useTranslation();

  return (
    <Switch>
      <AppRoute path="/">
        <FeedsPage />
      </AppRoute>

      <AppRoute path="/timeline">
        <TimelinePage />
      </AppRoute>

      <AppRoute path="/moments">
        <MomentsPage />
      </AppRoute>

      <AppRoute path="/friends">
        <FriendsPage />
      </AppRoute>

      <AppRoute path="/hashtags">
        <HashtagsPage />
      </AppRoute>

      <AppRoute path="/hashtag/:name">
        {(params) => <HashtagPage name={params.name || ""} />}
      </AppRoute>

      <AppRoute path="/search/:keyword">
        {(params) => <SearchPage keyword={params.keyword || ""} />}
      </AppRoute>

      <AdminRoute path="/admin/settings" requirePermission title={t("settings.title")} description={t("admin.settings_description")}>
        <Settings />
      </AdminRoute>

      <AdminRoute path="/admin/health" requirePermission title={t("health.title")} description={t("admin.health_description")}>
        <HealthPage />
      </AdminRoute>

      <AdminRoute path="/admin/comments" requirePermission title={t("moderation.title")} description={t("admin.comments_description")}>
        <CommentModerationPage />
      </AdminRoute>

      <AdminRoute path="/admin/users" requirePermission title={t("admin_users.title")} description={t("admin.users_description")}>
        <AdminUsersPage />
      </AdminRoute>

      <AdminRoute path="/admin/articles" requirePermission title={t("admin_articles.title")} description={t("admin_articles.description")}>
        <AdminArticlesPage />
      </AdminRoute>

      <AdminRoute path="/admin/plugins" requirePermission title={t("plugins.title")} description={t("plugins.description")}>
        <AdminPluginsPage />
      </AdminRoute>

      <AdminRoute path="/admin/plugins/:name/settings" requirePermission title={t("plugins.settings.title")} description={t("plugins.settings.description")}>
        <AdminPluginSettingsPage />
      </AdminRoute>

      <AdminRoute path="/admin/queue-status" requirePermission title={t("queue_status.title")} description={t("admin.queue_status_description")}>
        <QueueStatusPage />
      </AdminRoute>

      <AdminRoute path="/admin/compat-tasks" requirePermission title={t("compat_tasks.title")} description={t("admin.compat_tasks_description")}>
        <CompatTasksPage />
      </AdminRoute>

      <AdminRoute path="/admin/writing" requirePermission title={t("writing")} description={t("admin.writing_description")}>
        <WritingPage />
      </AdminRoute>

      <AdminRoute path="/admin/writing/:id" requirePermission title={t("writing")} description={t("admin.writing_description")}>
        {({ id }) => <WritingPage id={tryInt(0, id)} />}
      </AdminRoute>

      <AppRoute path="/callback">
        <CallbackPage />
      </AppRoute>

      <AppRoute path="/login">
        <LoginPage />
      </AppRoute>

      <AppRoute path="/register">
        <RegisterPage />
      </AppRoute>

      <AppRoute path="/profile">
        <ProfilePage />
      </AppRoute>

      {/* 插件页面：必须注册在 `/:alias` 通配路由之前，否则路径会被当成文章别名。
          PluginRoute 必须带上 `path` prop —— wouter 的 Switch 直接读子元素的
          props.path，为 undefined 时会退化成通配符，匹配掉所有路径（页面全白）。 */}
      {listPluginPages().map((page) => (
        <PluginRoute key={page.path} path={page.path} page={page} />
      ))}

      <TocRoute path="/feed/:id">
        {(params, toc, cleanup) => <FeedPage id={params.id || ""} TOC={toc} clean={cleanup} />}
      </TocRoute>

      <TocRoute path="/:alias">
        {(params, toc, cleanup) => <FeedPage id={params.alias || ""} TOC={toc} clean={cleanup} />}
      </TocRoute>

      <AppRoute path="/user/github">
        <TipsPage>
          <Tips value={t("error.api_url")} type="error" />
        </TipsPage>
      </AppRoute>

      <AppRoute path="/*/user/github">
        <TipsPage>
          <Tips value={t("error.api_url_slash")} type="error" />
        </TipsPage>
      </AppRoute>

      <AppRoute path="/user/github/callback">
        <TipsPage>
          <Tips value={t("error.github_callback")} type="error" />
        </TipsPage>
      </AppRoute>

      <AppRoute>
        <ErrorPage error={t("error.not_found")} />
      </AppRoute>
    </Switch>
  );
}

function AppRoute({
  path,
  children,
  headerComponent,
  paddingClassName,
  requirePermission,
}: {
  path?: PathPattern;
  children: ReactNode | ((params: DefaultParams) => ReactNode);
  headerComponent?: ReactNode;
  paddingClassName?: string;
  requirePermission?: boolean;
}) {
  const profile = useContext(ProfileContext);
  const siteConfig = useSiteConfig();
  const { t } = useTranslation();

  // profile 三态：undefined=加载中、null=未登录、对象=已登录。
  // 加载中不能判为「无权限」，否则管理员进后台会先闪一下「权限不足」。
  const isProfileLoading = profile === undefined;
  const content = requirePermission && !isProfileLoading && !profile?.permission ? (
    <ErrorPage error={t("error.permission_denied")} />
  ) : (
    children
  );

  return (
    <Route path={path}>
      {(params) => {
        const resolvedContent = typeof content === "function" ? content(params) : content;
        const layoutDefinition = getHeaderLayoutDefinition(siteConfig.headerLayout);
        // 插件插槽要按当前路径过滤，传真实路径而非 Route 的 path prop（可能是通配符）
        const [location] = useLocation();

        return layoutDefinition.renderRouteShell({
          header: <Header>{headerComponent}</Header>,
          content: <Padding className={paddingClassName}>{resolvedContent}</Padding>,
          footer: <Footer />,
          paddingClassName,
          path: location,
        });
      }}
    </Route>
  );
}

function PluginRoute({ path, page }: { path: string; page: PluginPage }) {
  const { t } = useTranslation();
  const profile = useContext(ProfileContext);

  // requireAdmin 只是 UI 层隐藏，不是安全边界 —— 服务端接口必须各自鉴权
  const denied = page.requireAdmin && !profile?.permission;

  // `path` 必须透传给 AppRoute：wouter 的 Switch 靠子元素的 props.path 匹配
  return (
    <AppRoute path={path}>
      {denied ? (
        <ErrorPage error={t("error.permission_denied")} />
      ) : (
        <page.Component />
      )}
    </AppRoute>
  );
}

function AdminRoute({
  path,
  children,
  requirePermission,
  title,
  description,
}: {
  path: PathPattern;
  children: ReactNode | ((params: DefaultParams) => ReactNode);
  requirePermission?: boolean;
  title: string;
  description: string;
}) {
  const profile = useContext(ProfileContext);
  const { t } = useTranslation();
  // profile 三态：undefined=加载中、null=未登录、对象=已登录。
  // 加载中不能判为「无权限」，否则管理员进后台会先闪一下「权限不足」。
  const isProfileLoading = profile === undefined;
  const content = requirePermission && !isProfileLoading && !profile?.permission ? (
    <ErrorPage error={t("error.permission_denied")} />
  ) : (
    children
  );

  return (
    <Route path={path}>
      {(params) => (
        <AdminLayout title={title} description={description}>
          {typeof content === "function" ? content(params) : content}
        </AdminLayout>
      )}
    </Route>
  );
}

function TocRoute({
  path,
  children,
}: {
  path: PathPattern;
  children: (params: DefaultParams, toc: () => JSX.Element, cleanup: (id: string) => void) => ReactNode;
}) {
  const { TOC, cleanup } = useTableOfContents(".toc-content");

  return (
    <AppRoute path={path} headerComponent={TOCHeader({ TOC })} paddingClassName="mx-4">
      {(params) => children(params, TOC, cleanup)}
    </AppRoute>
  );
}
