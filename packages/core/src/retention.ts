import { lt } from "drizzle-orm";
import { checkIn } from "@nag/schema";
import type { AnyDb } from "./db";
import { countFailed, countPending } from "./sync/outbox";

/**
 * The first day (UTC) of the previous calendar month relative to `now`.
 * Cutoff for local check-in retention: we keep current + previous month
 * locally, and re-fetch older periods on demand from the backend's
 * per-period summary endpoints.
 *
 * `Date.UTC(year, -1, 1)` correctly rolls back to December of the prior year
 * via JavaScript's normalised Date arithmetic, so January is handled
 * without a special case.
 */
export const previousMonthStart = (now: Date): Date => {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1, 0, 0, 0, 0),
  );
};

/**
 * Deletes every local check-in whose deemed `timestamp` is strictly older
 * than `cutoff`. Pure DB op — caller decides when it's safe to invoke
 * (see {@link pruneOldCheckInsIfSafe}).
 */
export const pruneOldCheckIns = async (
  db: AnyDb,
  cutoff: Date,
): Promise<void> => {
  await db.delete(checkIn).where(lt(checkIn.timestamp, cutoff));
};

/**
 * Prunes check-ins older than the start of the previous month, but only
 * when the outbox is fully drained (no pending or failed rows). This is
 * the safety net that prevents dropping a check-in whose `CreateCheckIn`
 * command hasn't yet been acknowledged by the server — once the outbox
 * is empty the server has every local write, so older rows can be
 * dropped freely and re-fetched via the summary endpoints if needed.
 *
 * Returns `true` if the prune ran, `false` if it was skipped because
 * the outbox wasn't clean.
 */
export const pruneOldCheckInsIfSafe = async (
  db: AnyDb,
  now: Date = new Date(),
): Promise<boolean> => {
  const pending = await countPending(db);
  const failed = await countFailed(db);
  if (pending > 0 || failed > 0) return false;
  await pruneOldCheckIns(db, previousMonthStart(now));
  return true;
};
