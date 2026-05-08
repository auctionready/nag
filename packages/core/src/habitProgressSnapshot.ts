import type { Regularity } from "@nag/schema";
import { isSameCalendarDay } from "./days";
import { checkInDaysMask, classifyScheduledDays } from "./dayCells";
import {
  type ComplianceColors,
  type MatchCheckInsToTimeSlotsResult,
  type ScheduleInfo,
  combineScheduleDays,
  isScheduledToday,
  matchCheckInsToTimeSlots,
  tileColor,
  withinDayColor,
} from "./trafficLight";

export type AnchorKind =
  /** Anchor day has at least one timed time-slot scheduled. */
  | "scheduled-day"
  /** Habit has schedules but none target the anchor's day-of-week. */
  | "off-day"
  /** Habit has no schedules at all — use frequency-only progress. */
  | "frequency-only"
  /** No goal, or a zero-frequency goal. */
  | "none";

export interface HabitProgressInput {
  goal: {
    frequency: number;
    regularity: Regularity;
    createdAt: Date;
  } | null;
  schedules: ScheduleInfo[];
  /**
   * All check-ins within the current period (day/week/month). Must include
   * back-filled check-ins — their `timestamp` is the deemed time-slot time.
   */
  periodCheckIns: { timestamp: Date; skipped?: boolean | null }[];
  /**
   * Pre-computed period check-in count. When omitted, falls back to
   * `periodCheckIns.length`. Supplying it lets callers use an authoritative
   * DB count while still passing a fuller list for mask/time-slot derivations.
   */
  periodCheckInCount?: number;
  /** Wall-clock "now". Drives traffic-light, within-day color, off-day detection. */
  now: Date;
  /**
   * The anchor day for `ring`, `anchorColor`, `time-slots`, and `headline`.
   * Defaults to `now`. Tile always passes `now`. Detail passes
   * `selectedDay ?? now` so the card can reflect the tapped day.
   */
  anchor?: Date;
  /** Color palette for the traffic-light + within-day overlays. */
  colors: ComplianceColors;
}

export interface HabitProgressSnapshot {
  /** Traffic-light color for the whole period (from `tileColor`). */
  periodColor: string;
  /** Check-ins / expected-so-far (schedule-aware), clamped 0–1. */
  periodProgress: number;
  /** Check-ins / full-period-frequency, clamped 0–1. */
  periodFrequencyProgress: number;

  /** Classification of the anchor-day situation. */
  anchorKind: AnchorKind;
  /** Donut-ring fill for the anchor, clamped 0–1. See Ring table in design. */
  ring: number;
  /**
   * Compliance color for the anchor day. Undefined when anchor is not the
   * current wall-clock day (so callers don't mis-apply a "now"-based color
   * to a past/future day) or when `withinDayColor` has no elapsed time-slots.
   */
  anchorColor: string | undefined;
  /**
   * True when today's anchor is off-schedule. Only ever true when the
   * anchor is today AND the habit has schedules but none fire today. Tile
   * uses this to mute itself grey; detail uses `anchorKind === "off-day"`
   * directly.
   */
  isAnchorOffDay: boolean;
  /**
   * Time-slot pairing for the anchor day. Null when the habit has no schedules
   * at all. `total === 0` with `schedules.length > 0` means the anchor
   * day-of-week has no matching schedule (off-day from the anchor's POV).
   */
  timeSlots: MatchCheckInsToTimeSlotsResult | null;

  /** Bitwise OR of every schedule's `days`. 0 means "no day-of-week schedule". */
  scheduledDaysMask: number;
  /** Days where every scheduled time-slot has a check-in. */
  completedDaysMask: number;
  /** Days where some — but not all — time-slots have a check-in. */
  partialDaysMask: number;
  /**
   * Day-of-week bitmask of every check-in in the period, *regardless* of
   * schedule. Lets callers dim-fill unscheduled days the user still
   * checked in on so those check-ins aren't invisible.
   */
  anyCheckInDaysMask: number;
  /**
   * For unscheduled weekly goals: the days the user actually checked in
   * on (used to light up the week strip with plain green). 0 otherwise.
   */
  unscheduledWeeklyMask: number;

  /** Structured headline data; callers format to strings. */
  headline: {
    kind: AnchorKind;
    /** `time-slots.done` when `scheduled-day`. */
    done?: number;
    /** `time-slots.total` when `scheduled-day`. */
    total?: number;
    /** `time-slots.extras` when `scheduled-day`. */
    extras?: number;
    /** Period check-in count when `frequency-only`. */
    completed?: number;
    /** Goal frequency when `frequency-only`. */
    frequency?: number;
    /** True iff the anchor is the current wall-clock day. */
    isToday: boolean;
  };
}

/**
 * Pure derivation of every "habit progress" signal both the board tile
 * and the habit detail screen need, from a single set of inputs. Both
 * views call this and render from the returned snapshot — anything not
 * derivable here (UI copy, affordances) stays in the caller.
 *
 * Ring definition (resolves the previous tile/detail divergence):
 *   - scheduled-day:   min(1, (time-slots.done + time-slots.extras) / max(1, time-slots.total))
 *   - off-day:         0
 *   - frequency-only:  min(1, count / goal.frequency)
 *   - none:            0
 */
export const habitProgressSnapshot = (
  input: HabitProgressInput,
): HabitProgressSnapshot => {
  const {
    goal,
    schedules,
    periodCheckIns,
    periodCheckInCount,
    now,
    anchor = now,
    colors,
  } = input;

  const checkInCount = periodCheckInCount ?? periodCheckIns.length;

  const tl = tileColor(goal, checkInCount, schedules, colors, now);

  const scheduledDaysMask = combineScheduleDays(schedules);
  const timeSlots =
    schedules.length > 0
      ? matchCheckInsToTimeSlots({
          schedules,
          checkIns: periodCheckIns,
          now: anchor,
        })
      : null;

  const hasGoal = goal !== null && goal.frequency > 0;
  let anchorKind: AnchorKind;
  if (schedules.length === 0) {
    anchorKind = hasGoal ? "frequency-only" : "none";
  } else if (timeSlots && timeSlots.total > 0) {
    anchorKind = "scheduled-day";
  } else {
    anchorKind = "off-day";
  }

  let ring = 0;
  if (anchorKind === "scheduled-day" && timeSlots) {
    ring = Math.min(
      1,
      (timeSlots.done + timeSlots.extras) / Math.max(1, timeSlots.total),
    );
  } else if (anchorKind === "frequency-only" && goal) {
    ring = Math.min(1, checkInCount / Math.max(1, goal.frequency));
  }

  const anchorIsToday = isSameCalendarDay(anchor, now);
  const anchorColor = anchorIsToday
    ? withinDayColor(
        {
          schedules,
          checkInTimestamps: periodCheckIns.map((c) => c.timestamp),
          now,
        },
        colors,
      )
    : undefined;

  const { completedDaysMask, partialDaysMask } = classifyScheduledDays({
    schedules,
    checkIns: periodCheckIns,
  });
  const anyCheckInDaysMask = checkInDaysMask(periodCheckIns);
  const unscheduledWeeklyMask =
    goal?.regularity === "week" && scheduledDaysMask === 0
      ? anyCheckInDaysMask
      : 0;

  const isAnchorOffDay =
    anchorIsToday &&
    scheduledDaysMask !== 0 &&
    !isScheduledToday(schedules, now);

  return {
    periodColor: tl.color,
    periodProgress: tl.progress,
    periodFrequencyProgress: tl.periodProgress,
    anchorKind,
    ring,
    anchorColor,
    isAnchorOffDay,
    timeSlots,
    scheduledDaysMask,
    completedDaysMask,
    partialDaysMask,
    anyCheckInDaysMask,
    unscheduledWeeklyMask,
    headline: {
      kind: anchorKind,
      done: timeSlots?.done,
      total: timeSlots?.total,
      extras: timeSlots?.extras,
      completed: anchorKind === "frequency-only" ? checkInCount : undefined,
      frequency: anchorKind === "frequency-only" ? goal?.frequency : undefined,
      isToday: anchorIsToday,
    },
  };
};
