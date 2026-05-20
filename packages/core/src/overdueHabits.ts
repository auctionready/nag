import type { AnyDb } from "./db";
import {
  allHabits,
  checkInsForHabitsOnDay,
  schedulesForHabits,
} from "./queries";
import { matchCheckInsToTimeSlots } from "./trafficLight";

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
  const habits = await allHabits(db);
  const habitIds = habits.map((h) => h.id);
  if (habitIds.length === 0) return 0;

  const schedules = await schedulesForHabits(db, habitIds);
  if (schedules.length === 0) return 0;

  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const checkIns = await checkInsForHabitsOnDay(db, habitIds, dayStart, dayEnd);

  type ScheduleRow = (typeof schedules)[number];
  const schedulesByHabit = new Map<string, ScheduleRow[]>();
  for (const s of schedules) {
    const list = schedulesByHabit.get(s.habitId) ?? [];
    list.push(s);
    schedulesByHabit.set(s.habitId, list);
  }

  const checkInsByHabit = new Map<
    string,
    { timestamp: Date; skipped: boolean | null }[]
  >();
  for (const c of checkIns) {
    const list = checkInsByHabit.get(c.habitId) ?? [];
    list.push({ timestamp: c.timestamp, skipped: c.skipped });
    checkInsByHabit.set(c.habitId, list);
  }

  let count = 0;
  for (const [habitId, habitSchedules] of schedulesByHabit) {
    const { timeSlots } = matchCheckInsToTimeSlots({
      schedules: habitSchedules,
      checkIns: checkInsByHabit.get(habitId) ?? [],
      now,
    });
    if (timeSlots.some((s) => s.status === "missed")) count++;
  }
  return count;
};
