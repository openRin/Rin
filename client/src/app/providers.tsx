import type { ReactNode } from "react";
import type { ConfigWrapper } from "@rin/config";
import type { Profile } from "../state/profile";
import { ClientConfigContext } from "../state/config";
import { ProfileContext } from "../state/profile";

export function AppProviders({
  children,
  config,
  profile,
}: {
  children: ReactNode;
  config: ConfigWrapper;
  profile: Profile | undefined | null;
}) {
  return (
    <ClientConfigContext.Provider value={config}>
      <ProfileContext.Provider value={profile}>
        {children}
      </ProfileContext.Provider>
    </ClientConfigContext.Provider>
  );
}
