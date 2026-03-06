import { useEffect, useRef, useState } from "react";
import { ConfigWrapper } from "@rin/config";
import type { Profile } from "../state/profile";
import { defaultClientConfig } from "../state/config";
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
    } else {
      client.config.get("client").then(({ data }) => {
        if (data) {
          sessionStorage.setItem("config", JSON.stringify(data));
          setConfig(new ConfigWrapper(data, defaultClientConfig));
        }
      });
    }

    initializedRef.current = true;
  }, []);

  return { config, profile };
}
