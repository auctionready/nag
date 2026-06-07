import type { AnyDb } from "./db";
import { getBadgeInputs, overdueCountAt } from "./badgeSchedule";

/**
 * Number of habits with at least one timed time-slot today whose scheduled
 * time has passed without a matching check-in. Used to drive the app-icon
 * badge.
 *
 * Counts habits, not time-slots — a habit with three missed morning slots
 * still only contributes one to the badge. Untimed schedules and habits
 * scheduled only on other days of the week don't contribute. The
 * `schedule.reminder` flag is intentionally ignored: a quiet visual badge
 * is a weaker signal than a push notification, and users who silence
 * notifications often still want the at-a-glance count.
 */
export const overdueHabitsCount = async (
  db: AnyDb,
  opts: { now?: Date } = {},
): Promise<number> => {
  const now = opts.now ?? new Date();
  const inputs = await getBadgeInputs(db, now);
  return overdueCountAt(inputs, now);
};
