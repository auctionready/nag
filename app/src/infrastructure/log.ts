const PREFIX = "[nag]";

/**
 * Tiny console wrapper with a consistent prefix + tag so logs are easy to
 * grep in Metro / device logs. Debug messages can be silenced by setting
 * `__NAG_LOG_LEVEL__` to `"info"` or higher on the global — we default to
 * logging everything while the sync pipeline is shaking out.
 */
type Level = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<Level, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const globalLevel = (): Level => {
  const g = globalThis as { __NAG_LOG_LEVEL__?: Level };
  return g.__NAG_LOG_LEVEL__ ?? "debug";
};

const enabled = (level: Level) =>
  LEVEL_ORDER[level] >= LEVEL_ORDER[globalLevel()];

export const log = (tag: string) => ({
  debug: (...args: unknown[]) => {
    if (enabled("debug")) console.log(`${PREFIX}[${tag}]`, ...args);
  },
  info: (...args: unknown[]) => {
    if (enabled("info")) console.log(`${PREFIX}[${tag}]`, ...args);
  },
  warn: (...args: unknown[]) => {
    if (enabled("warn")) console.warn(`${PREFIX}[${tag}]`, ...args);
  },
  error: (...args: unknown[]) => {
    if (enabled("error")) console.error(`${PREFIX}[${tag}]`, ...args);
  },
});
