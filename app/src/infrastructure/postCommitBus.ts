import { log } from "./log";

type Listener = () => void;

const listeners = new Set<Listener>();
const logger = log("bus");

/**
 * Fires after a local command has committed. Used to wake the outbox
 * dispatcher. Intentionally scoped to the app layer so `@nag/core` stays
 * free of app-side wiring.
 */
export const postCommitBus = {
  emit: (): void => {
    logger.debug(`emit → ${listeners.size} listener(s)`);
    for (const listener of listeners) {
      try {
        listener();
      } catch (error) {
        // Listener errors must not affect the caller of processCommand.
        logger.error("listener threw", error);
      }
    }
  },
  subscribe: (listener: Listener): (() => void) => {
    listeners.add(listener);
    logger.debug(`subscribe (total=${listeners.size})`);
    return () => {
      listeners.delete(listener);
      logger.debug(`unsubscribe (total=${listeners.size})`);
    };
  },
};
