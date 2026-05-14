import type { Profile } from "../../../state/profile";
import { BrandLink } from "./brand-link";
import { HeaderActions } from "./action-buttons";
import { Menu } from "./menu";
import { NavBar } from "./nav-bar";
import type { SiteHeaderConfig } from "../shared";

export function MobileTopHeader({
  children,
  profile,
  siteConfig,
  isAtTop,
  showDescription = false,
  showInlineNav = false,
  avatarClassName,
}: {
  children?: React.ReactNode;
  profile?: Profile | null;
  siteConfig: SiteHeaderConfig;
  isAtTop: boolean;
  showDescription?: boolean;
  showInlineNav?: boolean;
  avatarClassName?: string;
}) {
  return (
    <div className={`flex w-full items-center justify-between gap-3 px-4 py-2 lg:hidden ${isAtTop ? "bg-transparent backdrop-blur-none" : "bg-white/20 backdrop-blur-xl dark:bg-white/[0.03]"}`}>
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <BrandLink
          siteConfig={siteConfig}
          compact
          showDescription={showDescription}
          className="min-w-0 flex flex-row items-center"
          avatarClassName={avatarClassName}
        />
        {showInlineNav ? (
          <div className="hidden min-w-0 flex-1 items-center sm:flex">
            <div className="flex min-w-max items-center overflow-x-auto">
              <NavBar menu={false} itemClassName="px-0 py-1 pr-3 md:p-0 md:pr-3 text-sm text-neutral-600 dark:text-neutral-300" />
            </div>
          </div>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {children ? <div className="flex items-center text-sm t-primary">{children}</div> : null}
        <div className="hidden md:flex lg:hidden">
          <HeaderActions profile={profile} plain className="flex flex-row items-center gap-1" />
        </div>
        <Menu profile={profile} />
      </div>
    </div>
  );
}
