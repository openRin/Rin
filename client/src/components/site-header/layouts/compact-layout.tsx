import { BrandLink, HeaderActions, MobileTopHeader, NavBar } from "..";
import { PreviewActions, PreviewBrand, PreviewCanvas, PreviewContent, PreviewNav } from "../preview-primitives";
import type { HeaderLayoutDefinition } from "../layout-types";

const PREVIEW_ITEMS = ["Home", "Timeline", "Moments"];

export const compactLayoutDefinition: HeaderLayoutDefinition = {
  kind: "top",
  renderDesktop({ children, profile, siteConfig, isAtTop }) {
    return (
      <div className="hidden w-full lg:block">
        <div className={`flex items-center justify-between gap-8 px-4 py-3 ${isAtTop ? "bg-transparent backdrop-blur-none" : "bg-white/20 backdrop-blur-xl dark:bg-white/[0.03]"}`}>
          <BrandLink
            siteConfig={siteConfig}
            compact
            className="min-w-0 flex items-center"
            avatarClassName="h-10 w-10 rounded-full"
            titleClassName="text-base font-bold tracking-tight text-neutral-900 dark:text-neutral-50"
            showDescription={false}
          />
          <div className="flex min-w-0 flex-1 items-center justify-end">
            <div className="flex min-w-0 flex-row items-center justify-end text-sm t-primary">
              <NavBar menu={false} itemClassName="px-0 py-1 pr-3 md:p-0 md:pr-3 text-sm font-medium text-neutral-700 dark:text-neutral-200" />
            </div>
            <div className="flex shrink-0 flex-row items-center gap-3">
              {children ? <div className="flex items-center text-sm t-primary">{children}</div> : null}
              <HeaderActions profile={profile} plain className="flex flex-row items-center gap-3" />
            </div>
          </div>
        </div>
      </div>
    );
  },
  renderMobile({ children, profile, siteConfig, isAtTop }) {
    return (
      <MobileTopHeader
        children={children}
        profile={profile}
        siteConfig={siteConfig}
        isAtTop={isAtTop}
        showDescription={false}
        showInlineNav
        avatarClassName="h-8 w-8 rounded-lg"
      />
    );
  },
  renderPreview(data) {
    return (
      <PreviewCanvas
        className="w-full overflow-hidden rounded-[22px] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--preview-theme-color)_16%,white),rgba(255,255,255,0.78)_48%,rgba(255,255,255,0)_100%)] p-3 dark:bg-[linear-gradient(180deg,color-mix(in_srgb,var(--preview-theme-color)_20%,rgba(39,39,42,0.98)),rgba(24,24,27,0.78)_52%,rgba(24,24,27,0)_100%)]"
        style={{ ["--preview-theme-color" as string]: data.themeColor }}
      >
        <div className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
          <div className="min-w-0">
            <PreviewBrand data={data} compact />
          </div>
          <div className="flex items-center justify-end gap-3">
            <PreviewNav compact items={PREVIEW_ITEMS.slice(0, 2)} themeColor={data.themeColor} />
            <PreviewActions minimal themeColor={data.themeColor} />
          </div>
        </div>
        <PreviewContent transparent />
      </PreviewCanvas>
    );
  },
  renderRouteShell({ header, content, footer }) {
    return (
      <>
        {header}
        {content}
        {footer}
      </>
    );
  },
};
