const CLIENT_CONFIG_WINDOW_KEY = "__RIN_CLIENT_CONFIG__";

type WindowWithClientConfig = Window & {
  [CLIENT_CONFIG_WINDOW_KEY]?: Record<string, unknown>;
};

export function readBootstrappedClientConfig() {
  const globalWindow = window as WindowWithClientConfig;
  const config = globalWindow[CLIENT_CONFIG_WINDOW_KEY];

  if (!config || typeof config !== "object") {
    return null;
  }

  return config;
}
