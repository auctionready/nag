/**
 * Wraps a drizzle `$defaultFn` body so a throw surfaces which column
 * produced it. Drizzle re-throws the error from inside its insert
 * machinery, which loses the call site — useful when a polyfill-dependent
 * call like `crypto.randomUUID()` is missing at runtime.
 */
export const safeDefault =
  <T>(name: string, fn: () => T): (() => T) =>
  () => {
    try {
      return fn();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`[nag][schema] $defaultFn(${name}) threw`, err);
      throw err;
    }
  };
