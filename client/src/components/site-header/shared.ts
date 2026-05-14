import { useSiteConfig } from "../../hooks/useSiteConfig";

export type SiteHeaderConfig = ReturnType<typeof useSiteConfig>;

export const HEADER_POPUP_PANEL_CLASS =
  "rounded-2xl border border-black/10 bg-[rgba(255,255,255,0.78)] p-2 shadow-lg shadow-black/5 backdrop-blur-xl dark:border-white/10 dark:bg-[rgba(24,24,27,0.78)] dark:shadow-black/20";
