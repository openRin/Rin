export function getWranglerEnv() {
  return {
    ...process.env,
    XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME || "/tmp",
  };
}
