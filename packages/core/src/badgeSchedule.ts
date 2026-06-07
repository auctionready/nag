import type { AnyDb } from "./db";
import {
  allHabits,
  checkInsForHabitsOnDay,
  schedulesForHabits,
} from "./queries";
import type { ScheduleInfo } from "./trafficLight/types";
import { matchCheckInsToTimeSlots } from "./trafficLight";

/** Minimal check-in shape `matchCheckInsToTimeSlots` consumes. */
export interface BadgeCheckIn {
  timestamp: Date;
  skipped?: boolean | null;
}

export type SchedulesByHabit = Map<string, ScheduleInfo[]>;
export type CheckInsByHabit = Map<string, BadgeCheckIn[]>;

export interface BadgeInputs {
  schedulesByHabit: SchedulesByHabit;
  checkInsByHabit: CheckInsByHabit;
}

/**
 * Load the per-habit schedules and *today's* check-ins needed to evaluate the
 * overdue-habits badge at any instant. Bell-agnostic (uses
 * `schedulesForHabits`, not `allActiveSchedules`): silencing a reminder must
 * not silence the quieter visual badge — mirrors `overdueHabits`.
 *
 * Only today's check-ins are loaded: a future occurrence legitimately has no
 * check-ins yet, so `overdueCountAt` treats every elapsed slot that day as
 * still pending, consistent with how `syncAllNotifications` pre-computes
 * future reminder occurrences from the current check-in state.
 */
export const loadBadgeInputs = async (
  db: AnyDb,
  now: Date,
): Promise<BadgeInputs> => {
  const schedulesByHabit: SchedulesByHabit = new Map();
  const checkInsByHabit: CheckInsByHabit = new Map();

  const habits = await allHabits(db);
  const habitIds = habits.map((h) => h.id);
  if (habitIds.length === 0) return { schedulesByHabit, checkInsByHabit };

  const schedules = await schedulesForHabits(db, habitIds);
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const checkIns = await checkInsForHabitsOnDay(db, habitIds, dayStart, dayEnd);

  for (const s of schedules) {
    const list = schedulesByHabit.get(s.habitId) ?? [];
    list.push(s);
    schedulesByHabit.set(s.habitId, list);
  }
  for (const c of checkIns) {
    const list = checkInsByHabit.get(c.habitId) ?? [];
    list.push({ timestamp: c.timestamp, skipped: c.skipped });
    checkInsByHabit.set(c.habitId, list);
  }
  return { schedulesByHabit, checkInsByHabit };
};

/**
 * How many habits have at least one timed slot today that has elapsed as of
 * `at` without a matching check-in. Pure: same logic as `overdueHabitsCount`
 * but evaluated at an arbitrary instant so we can pre-compute the badge for a
 * future notification's fire time. Counts habits, not slots.
 */
export const overdueCountAt = (
  { schedulesByHabit, checkInsByHabit }: BadgeInputs,
  at: Date,
): number => {
  let count = 0;
  for (const [habitId, schedules] of schedulesByHabit) {
    const { timeSlots } = matchCheckInsToTimeSlots({
      schedules,
      checkIns: checkInsByHabit.get(habitId) ?? [],
      now: at,
    });
    if (timeSlots.some((s) => s.status === "missed")) count++;
  }
  return count;
};

export interface BadgeTransition {
  fireAt: Date;
  badge: number;
}

/**
 * The points *later today* at which the overdue-habits badge changes, plus a
 * reset to 0 at the start of tomorrow.
 *
 * The badge is a step function of wall-clock time: it rises at each distinct
 * slot time today as unsatisfied slots elapse, with no DB write. These
 * transitions let the OS advance the app-icon badge while the app is
 * backgrounded — each is delivered as a notification carrying the count that
 * will be overdue at that instant. Consecutive equal counts are collapsed
 * (a habit with several missed slots only steps the badge once), so we emit
 * the minimum number of notifications.
 *
 * The starting value (the badge "right now") is excluded — that's applied
 * live via `setBadgeCountAsync`; only future changes need pre-scheduling.
 */
export const buildBadgeTransitions = (
  inputs: BadgeInputs,
  now: Date,
): BadgeTransition[] => {
  const { schedulesByHabit } = inputs;
  const todayBit = 1 << now.getDay();

  const slotMinutes = new Set<number>();
  for (const schedules of schedulesByHabit.values()) {
    for (const s of schedules) {
      if (s.hour === null || s.hour === undefined) continue;
      const days = s.days ?? 0;
      if (!(days === 0 || (days & todayBit) !== 0)) continue;
      slotMinutes.add(s.hour * 60 + (s.minute ?? 0));
    }
  }

  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const futureMinutes = [...slotMinutes]
    .filter((m) => m > nowMinutes)
    .sort((a, b) => a - b);

  const transitions: BadgeTransition[] = [];
  let prev = overdueCountAt(inputs, now);
  for (const m of futureMinutes) {
    const fireAt = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      Math.floor(m / 60),
      m % 60,
      0,
      0,
    );
    const badge = overdueCountAt(inputs, fireAt);
    if (badge !== prev) {
      transitions.push({ fireAt, badge });
      prev = badge;
    }
  }

  // Clear today's overdue count at midnight so an app left backgrounded
  // overnight doesn't keep showing yesterday's stale badge.
  if (prev > 0) {
    transitions.push({
      fireAt: new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 1,
        0,
        0,
        0,
        0,
      ),
      badge: 0,
    });
  }

  return transitions;
};
