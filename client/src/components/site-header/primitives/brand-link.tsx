import { Link } from "wouter";
import type { SiteHeaderConfig } from "../shared";
import { ImageWithFallback } from "../../image-with-fallback";

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
        <ImageWithFallback
          src={siteConfig.avatar}
          alt={siteConfig.name}
          className={avatarClassName || (compact ? "h-10 w-10 rounded-full border-2" : "h-12 w-12 rounded-2xl border-2")}
        />
      ) : null}
      <div className={`${showAvatar ? (compact ? "mx-2" : "mx-4") : ""} flex min-w-0 flex-col items-start justify-center`}>
        <p className={`max-w-full truncate ${compact ? "text-sm font-bold t-primary" : "text-xl font-bold dark:text-white"} ${titleClassName}`}>{siteConfig.name}</p>
        {showDescription ? <p className={`max-w-full truncate text-xs text-neutral-500 ${descriptionClassName}`}>{siteConfig.description}</p> : null}
      </div>
    </Link>
  );
}
