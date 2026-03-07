import { useContext, useEffect, useState } from "react";
import { ProfileContext } from "../state/profile";
import { Padding } from "./padding";
import { useSiteConfig } from "../hooks/useSiteConfig";
import { getHeaderLayoutDefinition } from "./site-header/layout-registry";
import { normalizeHeaderBehavior, normalizeHeaderLayout } from "./site-header/layout-options";

export function Header({ children }: { children?: React.ReactNode }) {
  const profile = useContext(ProfileContext);
  const siteConfig = useSiteConfig();
  const headerLayout = normalizeHeaderLayout(siteConfig.headerLayout);
  const headerBehavior = normalizeHeaderBehavior(siteConfig.headerBehavior);
  const layoutDefinition = getHeaderLayoutDefinition(headerLayout);
  const [isRevealed, setIsRevealed] = useState(true);
  const [isAtTop, setIsAtTop] = useState(true);

  useEffect(() => {
    let lastScrollY = window.scrollY;
    const onScroll = () => {
      const currentScrollY = window.scrollY;
      const nearTop = currentScrollY <= 24;
      const scrollingUp = currentScrollY < lastScrollY;
      setIsAtTop(nearTop);
      setIsRevealed(headerBehavior !== "reveal" || nearTop || scrollingUp);
      lastScrollY = currentScrollY;
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    return () => {
      window.removeEventListener("scroll", onScroll);
    };
  }, [headerBehavior]);

  const useTopHeader = layoutDefinition.kind === "top";
  const headerPaddingClassName = headerLayout === "compact" ? "mx-0 mt-0" : "mx-4 mt-4";
  const containerClassName =
    !useTopHeader || headerBehavior === "static"
      ? "relative z-40"
      : `fixed inset-x-0 top-0 z-40 transition-transform duration-300 ${
          headerBehavior === "reveal" && !isRevealed ? "-translate-y-full" : "translate-y-0"
        }`;
  const spacerClassName = !useTopHeader || headerBehavior === "static" ? "h-0" : "h-20";

  return (
    <>
      {headerLayout === "compact" ? (
        <div className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-64 bg-gradient-to-b from-theme/15 to-white/0 dark:from-theme/20 dark:to-transparent" />
      ) : null}
      <div className={containerClassName}>
        <div className="w-screen">
          {headerLayout === "compact" ? (
            <div className="w-full">
              {layoutDefinition.renderMobile({ children, profile, siteConfig, behavior: headerBehavior, isAtTop })}
              {layoutDefinition.renderDesktop({ children, profile, siteConfig, behavior: headerBehavior, isAtTop })}
            </div>
          ) : (
            <Padding className={headerPaddingClassName}>
              <div className="w-full">
                {layoutDefinition.renderMobile({ children, profile, siteConfig, behavior: headerBehavior, isAtTop })}
                {layoutDefinition.renderDesktop({ children, profile, siteConfig, behavior: headerBehavior, isAtTop })}
              </div>
            </Padding>
          )}
        </div>
      </div>
      <div className={spacerClassName} />
    </>
  );
}
