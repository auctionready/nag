import { addDays, startOfDay } from "date-fns";
import type { AnyDb } from "./db";
import { atTimeOfDay, appliesOnDay } from "./days";
import { groupBy } from "./groupBy";
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
 * Query the per-habit schedules and *today's* check-ins needed to evaluate the
 * overdue-habits badge at any instant. Bell-agnostic (uses
 * `schedulesForHabits`, not `allActiveSchedules`): silencing a reminder must
 * not silence the quieter visual badge — mirrors `overdueHabits`.
 *
 * Only today's check-ins are queried: a future occurrence legitimately has no
 * check-ins yet, so `overdueCountAt` treats every elapsed slot that day as
 * still pending, consistent with how `syncAllNotifications` pre-computes
 * future reminder occurrences from the current check-in state.
 */
export const getBadgeInputs = async (
  db: AnyDb,
  now: Date,
): Promise<BadgeInputs> => {
  const habitIds = (await allHabits(db)).map((h) => h.id);
  if (habitIds.length === 0) {
    return { schedulesByHabit: new Map(), checkInsByHabit: new Map() };
  }

  const dayStart = startOfDay(now);
  const [schedules, checkIns] = await Promise.all([
    schedulesForHabits(db, habitIds),
    checkInsForHabitsOnDay(db, habitIds, dayStart, addDays(dayStart, 1)),
  ]);

  return {
    schedulesByHabit: groupBy(schedules, (s) => s.habitId),
    checkInsByHabit: groupBy(checkIns, (c) => c.habitId),
  };
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
): number =>
  [...schedulesByHabit].filter(([habitId, schedules]) =>
    matchCheckInsToTimeSlots({
      schedules,
      checkIns: checkInsByHabit.get(habitId) ?? [],
      now: at,
    }).timeSlots.some((s) => s.status === "missed"),
  ).length;

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
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  // Distinct slot times scheduled for today that are still in the future,
  // as `Date`s on today, ascending.
  const futureSlots = [
    ...new Set(
      [...inputs.schedulesByHabit.values()]
        .flat()
        .filter((s) => s.hour != null && appliesOnDay(s.days, now))
        .map((s) => (s.hour as number) * 60 + (s.minute ?? 0))
        .filter((m) => m > nowMinutes),
    ),
  ]
    .sort((a, b) => a - b)
    .map((m) => atTimeOfDay(now, Math.floor(m / 60), m % 60));

  const transitions: BadgeTransition[] = [];
  let prev = overdueCountAt(inputs, now);
  for (const fireAt of futureSlots) {
    const badge = overdueCountAt(inputs, fireAt);
    // Collapse consecutive equal counts: a habit with several missed slots
    // only steps the badge once.
    if (badge !== prev) {
      transitions.push({ fireAt, badge });
      prev = badge;
    }
  }

  // Clear today's overdue count at midnight so an app left backgrounded
  // overnight doesn't keep showing yesterday's stale badge.
  if (prev > 0) {
    transitions.push({ fireAt: startOfDay(addDays(now, 1)), badge: 0 });
  }

  return transitions;
};
