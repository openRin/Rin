import { useEffect, useRef, useState } from "react";
import { ConfigWrapper } from "@rin/config";
import type { Profile } from "../state/profile";
import { defaultClientConfig } from "../state/config";
import { applyThemeColor } from "../utils/theme-color";
import { client } from "./runtime";

function applyViewportScaling() {
  const highResolutionThreshold = 2560;
  document.documentElement.style.fontSize = window.screen.width >= highResolutionThreshold ? "125%" : "100%";
}

export function useAppBootstrap() {
  const initializedRef = useRef(false);
  const [profile, setProfile] = useState<Profile | undefined | null>(undefined);
  const [config, setConfig] = useState<ConfigWrapper>(new ConfigWrapper({}, new Map()));

  useEffect(() => {
    applyViewportScaling();

    if (initializedRef.current) {
      return;
    }

    const updateClientConfig = (nextConfig: Record<string, unknown>) => {
      sessionStorage.setItem("config", JSON.stringify(nextConfig));
      setConfig(new ConfigWrapper(nextConfig, defaultClientConfig));
      applyThemeColor(typeof nextConfig["theme.color"] === "string" ? nextConfig["theme.color"] : undefined);
    };

    const refreshClientConfig = async () => {
      const { data } = await client.config.get("client");
      if (!data) {
        return;
      }

      const serializedNext = JSON.stringify(data);
      const serializedCurrent = sessionStorage.getItem("config");
      if (serializedCurrent !== serializedNext) {
        updateClientConfig(data);
      }
    };

    client.user.profile().then(({ data, error }) => {
      if (data) {
        setProfile({
          id: data.id,
          avatar: data.avatar || "",
          permission: data.permission,
          name: data.username,
        });
      } else if (error) {
        setProfile(null);
      }
    });

    const cachedConfig = sessionStorage.getItem("config");
    if (cachedConfig) {
      const configObject = JSON.parse(cachedConfig) as Record<string, unknown>;
      setConfig(new ConfigWrapper(configObject, defaultClientConfig));
      applyThemeColor(typeof configObject["theme.color"] === "string" ? configObject["theme.color"] : undefined);
    }

    refreshClientConfig();

    const handleFocus = () => {
      refreshClientConfig();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refreshClientConfig();
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    initializedRef.current = true;

    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return { config, profile };
}
