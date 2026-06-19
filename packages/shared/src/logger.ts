export type LogLevel = "silent" | "error" | "warn" | "info" | "debug";

const ORDER: Record<LogLevel, number> = {
  silent: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
};

export interface Logger {
  level: LogLevel;
  error(msg: string): void;
  warn(msg: string): void;
  info(msg: string): void;
  debug(msg: string): void;
  success(msg: string): void;
}

/**
 * Minimal logger. All output goes to stderr so stdout stays clean for data
 * (e.g. a future `--json` mode).
 */
export function createLogger(level: LogLevel = "info"): Logger {
  const enabled = (l: LogLevel): boolean => ORDER[level] >= ORDER[l];
  const write = (msg: string): void => {
    process.stderr.write(msg + "\n");
  };
  return {
    level,
    error: (msg) => enabled("error") && write(`[athar] error: ${msg}`),
    warn: (msg) => enabled("warn") && write(`[athar] warn: ${msg}`),
    info: (msg) => enabled("info") && write(`[athar] ${msg}`),
    debug: (msg) => enabled("debug") && write(`[athar] debug: ${msg}`),
    success: (msg) => enabled("info") && write(`[athar] ${msg}`),
  };
}
