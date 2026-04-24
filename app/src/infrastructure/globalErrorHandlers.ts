import * as Sentry from "@sentry/react-native";
import { log } from "./log";

const logger = log("global-error");

type GlobalHandler = (error: Error, isFatal?: boolean) => void;

type HermesPromiseTracker = (opts: {
  allRejections: boolean;
  onUnhandled: (id: number, rejection: unknown) => void;
  onHandled?: (id: number) => void;
}) => void;

/**
 * Installs RN-wide safety nets so errors the sync pipeline would otherwise
 * swallow show up in Metro logs (and Sentry):
 *
 *   - `ErrorUtils.setGlobalHandler` — catches any uncaught synchronous JS
 *     error on the RN JS thread. Chains the previous handler so RedBox
 *     behavior in dev and Sentry's native handler stay intact.
 *   - `HermesInternal.enablePromiseRejectionTracker` — Hermes's opt-in
 *     tracker for unhandled promise rejections. Without it, a `throw`
 *     inside an awaited callback that nobody `.catch`es evaporates.
 */
export const installGlobalErrorHandlers = (): void => {
  const g = globalThis as {
    ErrorUtils?: {
      getGlobalHandler?: () => GlobalHandler | undefined;
      setGlobalHandler?: (fn: GlobalHandler) => void;
    };
    HermesInternal?: {
      enablePromiseRejectionTracker?: HermesPromiseTracker;
    };
  };

  if (g.ErrorUtils?.setGlobalHandler) {
    const prev = g.ErrorUtils.getGlobalHandler?.();
    g.ErrorUtils.setGlobalHandler((error, isFatal) => {
      logger.error(`uncaught JS error (isFatal=${isFatal})`, error);
      Sentry.captureException(error);
      prev?.(error, isFatal);
    });
    logger.info("ErrorUtils.setGlobalHandler installed");
  } else {
    logger.warn("ErrorUtils.setGlobalHandler unavailable");
  }

  if (g.HermesInternal?.enablePromiseRejectionTracker) {
    g.HermesInternal.enablePromiseRejectionTracker({
      allRejections: true,
      onUnhandled: (id, rejection) => {
        logger.error(`unhandledRejection id=${id}`, rejection);
        Sentry.captureException(rejection);
      },
      onHandled: (id) => {
        logger.debug(`promise rejection handled late id=${id}`);
      },
    });
    logger.info("HermesInternal.enablePromiseRejectionTracker installed");
  } else {
    logger.warn("HermesInternal.enablePromiseRejectionTracker unavailable");
  }
};
