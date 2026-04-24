/**
 * Wraps an async function so that overlapping calls coalesce:
 *   - While a call is in-flight, new invocations return the same promise.
 *   - If at least one invocation arrived during the in-flight run, exactly
 *     one follow-up run is scheduled once the current one settles.
 *
 * This pattern is used around the outbox dispatcher because multiple
 * triggers (NetInfo online, AppState active, post-commit, startup, safety
 * timer) can fire in rapid succession.
 */
export const makeSingleflight = <T>(
  fn: () => Promise<T>,
): (() => Promise<T | void>) => {
  let running: Promise<T> | null = null;
  let pendingRerun = false;

  const wrapped = async (): Promise<T | void> => {
    if (running) {
      pendingRerun = true;
      return running;
    }

    running = (async () => {
      try {
        return await fn();
      } finally {
        running = null;
        if (pendingRerun) {
          pendingRerun = false;
          // Fire-and-forget — the caller already got its promise above.
          void wrapped();
        }
      }
    })();

    return running;
  };

  return wrapped;
};
