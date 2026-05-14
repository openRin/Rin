const colors = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
} as const;

function log(label: string, message: string, color: string) {
  const timestamp = new Date().toLocaleTimeString("zh-CN", { hour12: false });
  console.log(`${colors.dim}[${timestamp}]${colors.reset} ${color}[${label}]${colors.reset} ${message}`);
}

export const logger = {
  info: (message: string) => log("INFO", message, colors.blue),
  success: (message: string) => log("SUCCESS", message, colors.green),
  warn: (message: string) => log("WARN", message, colors.yellow),
  error: (message: string) => log("ERROR", message, colors.red),
};
