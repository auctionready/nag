type Listener = () => void;

const listeners = new Set<Listener>();

/**
 * Fires after a local command has committed. Used to wake the outbox
 * dispatcher. Intentionally scoped to the app layer so `@nag/core` stays
 * free of app-side wiring.
 */
export const postCommitBus = {
  emit: (): void => {
    for (const listener of listeners) {
      try {
        listener();
      } catch {
        // Listener errors must not affect the caller of processCommand.
      }
    }
  },
  subscribe: (listener: Listener): (() => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
