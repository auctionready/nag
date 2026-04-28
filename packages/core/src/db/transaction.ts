import { sql } from "drizzle-orm";
import type { AnyDb } from "./index";

let chain: Promise<unknown> = Promise.resolve();

/**
 * Serializes `BEGIN` / `COMMIT` blocks across the single shared expo-sqlite
 * connection. Without this, two async callers that each `await db.run("BEGIN")`
 * race: the second throws `cannot start a transaction within a transaction`
 * (surfaced as `DrizzleError: Failed to run the query 'BEGIN'`).
 *
 * Drizzle's expo-sqlite `db.transaction()` callback is sync-only and commits
 * before awaited writes resolve, so we keep raw `BEGIN`/`COMMIT` and gate it
 * with this module-level promise chain.
 */
export const withTransaction = <T>(
  db: AnyDb,
  fn: () => Promise<T>,
): Promise<T> => {
  const next = chain.then(async () => {
    await db.run(sql`BEGIN`);
    try {
      const result = await fn();
      await db.run(sql`COMMIT`);
      return result;
    } catch (e) {
      try {
        await db.run(sql`ROLLBACK`);
      } catch {}
      throw e;
    }
  });
  chain = next.catch(() => {});
  return next;
};
