import { BrandLink, HeaderActions, Menu, NavBar } from "..";
import { PreviewActions, PreviewBrand, PreviewCanvas, PreviewContent, PreviewNav } from "../preview-primitives";
import type { HeaderLayoutDefinition } from "../layout-types";

const PREVIEW_ITEMS = ["Home", "Timeline", "Moments"];

export const classicLayoutDefinition: HeaderLayoutDefinition = {
  kind: "top",
  renderDesktop({ children, profile, siteConfig }) {
    return (
      <div className="hidden w-full items-center justify-between md:flex">
        <BrandLink siteConfig={siteConfig} className="mr-8 hidden flex-row items-center md:flex" />
        <div className="flex min-w-0 flex-1 items-center justify-center">
          <div className="scrollbar-none min-w-0 max-w-full overflow-x-auto rounded-full bg-w px-2 shadow-xl shadow-light t-primary">
            <div className="flex min-w-max flex-row items-center whitespace-nowrap">
              <NavBar menu={false} itemClassName="whitespace-nowrap px-3 py-3 md:p-3 text-[15px]" />
            </div>
          </div>
        </div>
        <div className="ml-8 hidden flex-row items-center space-x-2 md:flex">
          {children ? <div className="flex items-center text-sm t-primary">{children}</div> : null}
          <HeaderActions profile={profile} className="flex flex-row items-center space-x-2" />
        </div>
      </div>
    );
  },
  renderMobile({ children, profile, siteConfig }) {
    return (
      <div className="flex w-full flex-row items-center justify-center md:hidden">
        <div className="w-full flex-row items-center justify-center transition-all duration-500">
          <div className="flex flex-row items-center rounded-full bg-w px-2 shadow-xl shadow-light t-primary">
            <BrandLink
              siteConfig={siteConfig}
              compact
              className="visible mr-auto flex flex-row items-center py-2 opacity-100 duration-300 md:hidden"
            />
            <NavBar menu={false} />
            <div className="ml-auto flex items-center gap-1">
              {children ? <div className="flex items-center text-sm t-primary">{children}</div> : null}
              <Menu profile={profile} />
            </div>
          </div>
        </div>
      </div>
    );
  },
  renderPreview(data) {
    return (
      <PreviewCanvas className="w-full overflow-hidden rounded-[22px] p-3">
        <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
          <PreviewBrand data={data} />
          <div className="mx-2 flex min-w-0 items-center justify-center">
            <div className="max-w-full rounded-full bg-white px-2 py-2 shadow-lg shadow-black/5 ring-1 ring-black/5 dark:bg-white/[0.08] dark:shadow-black/20 dark:ring-white/10">
              <PreviewNav center items={PREVIEW_ITEMS} themeColor={data.themeColor} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-full bg-black/[0.04] dark:bg-white/[0.08]" />
            <PreviewActions themeColor={data.themeColor} />
          </div>
        </div>
        <PreviewContent />
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
