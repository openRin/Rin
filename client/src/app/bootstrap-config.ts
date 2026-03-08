const CLIENT_CONFIG_WINDOW_KEY = "__RIN_CLIENT_CONFIG__";

type GlobalWithClientConfig = typeof globalThis & {
  [CLIENT_CONFIG_WINDOW_KEY]?: Record<string, unknown>;
};

export function readBootstrappedClientConfig() {
  const globalObject = globalThis as GlobalWithClientConfig;
  const config = globalObject[CLIENT_CONFIG_WINDOW_KEY];

  if (!config || typeof config !== "object") {
    return null;
  }

  return config;
}
