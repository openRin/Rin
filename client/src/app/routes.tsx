import type { ReactNode } from "react";
import { useContext, useEffect } from "react";
import type { DefaultParams, PathPattern } from "wouter";
import { Route, Switch, useLocation } from "wouter";
import { AdminLayout } from "../components/admin-layout";
import Footer from "../components/footer";
import { Header } from "../components/header";
import { Padding } from "../components/padding";
import { Tips, TipsPage } from "../components/tips";
import useTableOfContents from "../hooks/useTableOfContents";
import { CallbackPage } from "../page/callback";
import { ErrorPage } from "../page/error";
import { FeedPage, TOCHeader } from "../page/feed";
import { FeedsPage } from "../page/feeds";
import { FriendsPage } from "../page/friends";
import { HashtagPage } from "../page/hashtag";
import { HashtagsPage } from "../page/hashtags";
import { LoginPage } from "../page/login";
import { MomentsPage } from "../page/moments";
import { ProfilePage } from "../page/profile";
import { SearchPage } from "../page/search";
import { Settings } from "../page/settings";
import { TimelinePage } from "../page/timeline";
import { WritingPage } from "../page/writing";
import { ProfileContext } from "../state/profile";
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

      <AppRoute path="/admin">
        <AdminRedirect href="/admin/writing" />
      </AppRoute>

      <AdminRoute path="/admin/settings" requirePermission title={t("settings.title")} description={t("admin.settings_description")}>
        <Settings />
      </AdminRoute>

      <AdminRoute path="/admin/writing" requirePermission title={t("writing")} description={t("admin.writing_description")}>
        <WritingPage />
      </AdminRoute>

      <AdminRoute path="/admin/writing/:id" requirePermission title={t("writing")} description={t("admin.writing_description")}>
        {({ id }) => <WritingPage id={tryInt(0, id)} />}
      </AdminRoute>

      <AppRoute path="/settings">
        <AdminRedirect href="/admin/settings" />
      </AppRoute>

      <AppRoute path="/writing">
        <AdminRedirect href="/admin/writing" />
      </AppRoute>

      <AppRoute path="/writing/:id">
        {({ id }) => <AdminRedirect href={`/admin/writing/${id || ""}`} />}
      </AppRoute>

      <AppRoute path="/callback">
        <CallbackPage />
      </AppRoute>

      <AppRoute path="/login">
        <LoginPage />
      </AppRoute>

      <AppRoute path="/profile">
        <ProfilePage />
      </AppRoute>

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

function AdminRedirect({ href }: { href: string }) {
  const [, setLocation] = useLocation();

  useEffect(() => {
    setLocation(href);
  }, [href, setLocation]);

  return null;
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
  const { t } = useTranslation();

  const content =
    requirePermission && !profile?.permission ? <ErrorPage error={t("error.permission_denied")} /> : children;

  return (
    <Route path={path}>
      {(params) => (
        <>
          <Header>{headerComponent}</Header>
          <Padding className={paddingClassName}>{typeof content === "function" ? content(params) : content}</Padding>
          <Footer />
        </>
      )}
    </Route>
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
  const content =
    requirePermission && !profile?.permission ? <ErrorPage error={t("error.permission_denied")} /> : children;

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
