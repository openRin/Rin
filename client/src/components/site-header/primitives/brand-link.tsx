import { Link } from "wouter";
import type { SiteHeaderConfig } from "../shared";

export function BrandLink({
  siteConfig,
  className = "",
  avatarClassName,
  compact = false,
  showAvatar = true,
  showDescription = true,
  titleClassName = "",
  descriptionClassName = "",
}: {
  siteConfig: SiteHeaderConfig;
  className?: string;
  avatarClassName?: string;
  compact?: boolean;
  showAvatar?: boolean;
  showDescription?: boolean;
  titleClassName?: string;
  descriptionClassName?: string;
}) {
  return (
    <Link aria-label="home" href="/" className={className}>
      {showAvatar && siteConfig.avatar ? (
        <img
          src={siteConfig.avatar}
          alt="Avatar"
          className={avatarClassName || (compact ? "h-10 w-10 rounded-full border-2" : "h-12 w-12 rounded-2xl border-2")}
        />
      ) : null}
      <div className={`${showAvatar ? (compact ? "mx-2" : "mx-4") : ""} flex flex-col justify-center items-start`}>
        <p className={`${compact ? "text-sm font-bold t-primary" : "text-xl font-bold dark:text-white"} ${titleClassName}`}>{siteConfig.name}</p>
        {showDescription ? <p className={`text-xs text-neutral-500 ${descriptionClassName}`}>{siteConfig.description}</p> : null}
      </div>
    </Link>
  );
}
