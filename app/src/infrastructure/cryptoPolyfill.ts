import { randomUUID } from "expo-crypto";
import { log } from "./log";

const logger = log("crypto-polyfill");

/**
 * Hermes on RN does not currently expose `crypto.randomUUID`. The schema's
 * drizzle `$defaultFn`s for `habit.externalId`, `check_in.externalId`, and
 * `audit_log.envelope_id` rely on it, so an unpolyfilled runtime silently
 * rejects every insert. Install an `expo-crypto`-backed shim at app startup.
 *
 * Must run before the first DB insert. Called from `init()` which fires at
 * the top of `app/_layout.tsx` (before any user interaction).
 */
export const installCryptoPolyfill = (): void => {
  const g = globalThis as { crypto?: { randomUUID?: () => string } };
  if (typeof g.crypto?.randomUUID === "function") {
    logger.debug("crypto.randomUUID already present — no polyfill needed");
    return;
  }
  if (!g.crypto) {
    Object.defineProperty(globalThis, "crypto", {
      value: { randomUUID },
      writable: true,
      configurable: true,
    });
  } else {
    g.crypto.randomUUID = randomUUID;
  }
  try {
    const sample = globalThis.crypto.randomUUID();
    logger.debug(
      `installed crypto.randomUUID via expo-crypto (sample=${sample})`,
    );
  } catch (e) {
    logger.error("expo-crypto randomUUID threw when sampled", e);
  }
};
