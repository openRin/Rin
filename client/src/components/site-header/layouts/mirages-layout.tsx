import { createContext, useContext, useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { HeaderActions, NavBar } from "..";
import { PreviewActions, PreviewBrand, PreviewCanvas, PreviewContent, PreviewNav } from "../preview-primitives";
import type { HeaderLayoutDefinition } from "../layout-types";
import { ProfileContext } from "../../../state/profile";
import { useSiteConfig } from "../../../hooks/useSiteConfig";
import { MiragesHero } from "./mirages-hero";

const PREVIEW_ITEMS = ["Home", "Timeline", "Moments"];

type MiragesSidebarContextValue = {
  isOpen: boolean;
  toggle: () => void;
};

const MiragesSidebarContext = createContext<MiragesSidebarContextValue>({ isOpen: false, toggle: () => {} });

function useMiragesSidebar() {
  return useContext(MiragesSidebarContext);
}

function MiragesDrawer({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const siteConfig = useSiteConfig();
  const profile = useContext(ProfileContext);
  return (
    <>
      {isOpen ? (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm lg:hidden" onClick={onClose} />
      ) : null}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col overflow-y-auto border-r border-black/5 bg-[#fafafa] p-5 shadow-xl shadow-black/10 transition-transform duration-300 dark:border-white/10 dark:bg-[#2c2a2a] ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="mb-6 flex flex-col items-center">
          <Link href="/" onClick={onClose}>
            {siteConfig.avatar ? (
              <img
                src={siteConfig.avatar}
                alt="Avatar"
                className="h-20 w-20 rounded-full border-2 border-black/10 object-cover dark:border-white/10"
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-black/10 text-3xl font-bold text-neutral-400 dark:bg-white/10">
                {siteConfig.name?.[0] ?? "R"}
              </div>
            )}
          </Link>
          <p className="mt-3 text-lg font-bold text-neutral-800 dark:text-neutral-100">{siteConfig.name}</p>
          {siteConfig.description ? (
            <p className="mt-1 text-center text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">{siteConfig.description}</p>
          ) : null}
        </div>

        <div className="mb-5 flex items-center rounded-full border border-black/10 bg-white px-4 py-2 dark:border-white/10 dark:bg-black/20">
          <i className="ri-search-line mr-2 text-sm text-neutral-400" />
          <Link href="/search/" onClick={onClose} className="w-full text-sm text-neutral-500 dark:text-neutral-400">
            {t("article.search.placeholder")}
          </Link>
        </div>

        <nav className="flex flex-col gap-1">
          <SidebarItem href="/" title={t("article.title")} onClose={onClose} selectedPrefix="/feed" />
          <SidebarItem href="/timeline" title={t("timeline")} onClose={onClose} />
          <SidebarItem href="/moments" title={t("moments.title")} onClose={onClose} />
          <SidebarItem href="/hashtags" title={t("hashtags")} onClose={onClose} />
          <SidebarItem href="/friends" title={t("friends.title")} onClose={onClose} />
          <SidebarItem href="/about" title={t("about.title")} onClose={onClose} />
        </nav>

        <div className="mt-auto flex items-center justify-center gap-3 pt-6 text-neutral-400 dark:text-neutral-500">
          <a href="/rss.xml" aria-label="RSS" className="transition-colors hover:text-theme"><i className="ri-rss-fill ri-lg" /></a>
          <span className="text-[11px]">{profile?.name ?? siteConfig.name}</span>
        </div>
      </aside>
    </>
  );
}

function SidebarItem({
  href,
  title,
  onClose,
  selectedPrefix,
}: {
  href: string;
  title: string;
  onClose: () => void;
  selectedPrefix?: string;
}) {
  const [location] = useLocation();
  const selected = selectedPrefix ? location.startsWith(selectedPrefix) || location === href : location === href;
  return (
    <Link
      href={href}
      onClick={onClose}
      className={`rounded-lg px-4 py-2.5 text-sm transition-colors ${
        selected
          ? "bg-theme/10 font-medium text-theme"
          : "text-neutral-700 hover:bg-black/5 dark:text-neutral-300 dark:hover:bg-white/5"
      }`}
    >
      {title}
    </Link>
  );
}

function MiragesMenuButton() {
  const { toggle } = useMiragesSidebar();
  return (
    <button
      onClick={toggle}
      aria-label="Menu"
      className="flex h-9 w-9 items-center justify-center rounded-full text-neutral-600 transition-colors hover:bg-black/5 dark:text-neutral-300 dark:hover:bg-white/10"
    >
      <i className="ri-menu-3-line ri-lg" />
    </button>
  );
}

function MiragesShell({ header, content, footer }: { header: React.ReactNode; content: React.ReactNode; footer: React.ReactNode }) {
    const [isOpen, setIsOpen] = useState(false);
    const [location] = useLocation();
    const isHome = location === "/";
    const listPages = ["timeline", "moments", "friends", "hashtags", "hashtag"];
    const firstSegment = location.split("/")[1] || "";
    const isListPage = isHome || listPages.includes(firstSegment);
    const isArticle = !isListPage && firstSegment.length > 0 && !["about", "archives", "login", "profile", "admin", "callback", "user", "search"].includes(firstSegment);

    useEffect(() => {
        setIsOpen(false);
    }, [location]);

    useEffect(() => {
        document.body.classList.add("mirages-layout-active");
        return () => {
            document.body.classList.remove("mirages-layout-active");
        };
    }, []);

    const containerClass = isListPage
        ? "-mt-12 max-w-[952px] px-[48px] pt-[64px] pb-[56px] md:px-[60px] md:pt-[86px]"
        : "max-w-[864px] px-0 pt-[46px] pb-[56px] md:px-4";

    return (
        <MiragesSidebarContext.Provider value={{ isOpen, toggle: () => setIsOpen((v) => !v) }}>
            <div className="mirages-root min-h-screen">
                <MiragesDrawer isOpen={isOpen} onClose={() => setIsOpen(false)} />
                {header}
                <MiragesHero />
                <div className={`mirages-content mx-auto w-full ${containerClass}`} data-article={isArticle ? "true" : undefined}>
                    {content}
                </div>
                <div className="mirages-footer">{footer}</div>
            </div>
        </MiragesSidebarContext.Provider>
    );
}

export const miragesLayoutDefinition: HeaderLayoutDefinition = {
  kind: "top",
  renderDesktop({ children, profile, siteConfig }) {
    return (
      <div className="mx-auto hidden h-16 w-full max-w-[1200px] items-center justify-between px-4 md:flex">
        <div className="flex min-w-0 flex-1 items-center">
          <Link href="/" aria-label="home" className="text-[20px] font-bold text-black/90 dark:text-white/90">
            {siteConfig.name}
          </Link>
        </div>
        <div className="flex min-w-0 flex-1 items-center justify-center">
          <div className="flex min-w-max items-center gap-0 text-[16px]">
            <NavBar menu={false} itemClassName="px-2 py-2 text-[16px] text-black/90 dark:text-white/90 hover:text-theme duration-300" />
          </div>
        </div>
        <div className="ml-4 flex flex-1 items-center justify-end gap-2">
          {children ? <div className="flex items-center text-sm t-primary">{children}</div> : null}
          <HeaderActions profile={profile} className="mirages-header-actions flex flex-row items-center gap-2" />
        </div>
      </div>
    );
  },
  renderMobile({ children, profile, siteConfig }) {
    return (
      <div className="flex h-14 w-full items-center justify-between px-2 md:hidden">
        <div className="flex min-w-0 flex-1 items-center gap-1">
          <MiragesMenuButton />
          <Link href="/" aria-label="home" className="text-[20px] font-bold text-black/90 dark:text-white/90">
            {siteConfig.name}
          </Link>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {children ? <div className="flex items-center text-sm t-primary">{children}</div> : null}
          <HeaderActions profile={profile} className="mirages-header-actions flex flex-row items-center gap-1" />
        </div>
      </div>
    );
  },
  renderPreview(data) {
    return (
      <PreviewCanvas className="w-full overflow-hidden rounded-[22px] bg-white p-3 dark:bg-[#2c2a2a]">
        <div className="flex items-center gap-3">
          <PreviewBrand data={data} />
          <div className="flex min-w-0 flex-1 items-center justify-center">
            <PreviewNav items={PREVIEW_ITEMS} themeColor={data.themeColor} />
          </div>
          <PreviewActions minimal themeColor={data.themeColor} />
        </div>
        <div className="mt-3 flex h-10 items-center justify-center rounded-xl bg-black/[0.03] dark:bg-white/[0.04]">
          <span className="text-[9px] font-semibold text-neutral-400">Hero</span>
        </div>
        <PreviewContent />
      </PreviewCanvas>
    );
  },
  renderRouteShell({ header, content, footer }) {
    return <MiragesShell header={header} content={content} footer={footer} />;
  },
};
