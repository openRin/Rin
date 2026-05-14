import type { ReactNode } from "react";
import type { Profile } from "../../state/profile";
import type { HeaderBehaviorOption, HeaderLayoutOption } from "./layout-options";
import type { SiteHeaderConfig } from "./shared";

export type HeaderLayoutRenderProps = {
  children?: ReactNode;
  profile?: Profile | null;
  siteConfig: SiteHeaderConfig;
  behavior: HeaderBehaviorOption;
  isAtTop: boolean;
};

export type HeaderLayoutPreviewData = {
  avatar: string;
  name: string;
  themeColor: string;
};

export type HeaderLayoutDefinition = {
  kind: "top" | "sidebar";
  renderDesktop: (props: HeaderLayoutRenderProps) => ReactNode;
  renderMobile: (props: HeaderLayoutRenderProps) => ReactNode;
  renderPreview: (data: HeaderLayoutPreviewData) => ReactNode;
  renderRouteShell: (props: {
    header: ReactNode;
    content: ReactNode;
    footer: ReactNode;
    paddingClassName?: string;
  }) => ReactNode;
};

export type HeaderLayoutRegistry = Record<HeaderLayoutOption, HeaderLayoutDefinition>;
