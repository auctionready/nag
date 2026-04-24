const PREFIX = "[nag]";

/**
 * Tiny console wrapper with a consistent prefix + tag so logs are easy to
 * grep in Metro / device logs.
 *
 * Default level is `info` so steady-state output is readable: one line per
 * dispatcher run completion, per row marked-sent, per startup config
 * announcement, and all warns/errors. Flip to `debug` to get per-kick,
 * per-POST, per-row-transition, and per-netinfo-event detail:
 *
 *     globalThis.__NAG_LOG_LEVEL__ = "debug";
 *
 * in a Metro console or add it to your dev entry point.
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
  return g.__NAG_LOG_LEVEL__ ?? "info";
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
