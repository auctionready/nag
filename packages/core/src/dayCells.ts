import { mondayFirstDayLetters } from "./days";
import type { ScheduleInfo } from "./trafficLight/types";

export interface DayCell {
  letter: string;
  scheduled: boolean;
  /** Background color for the day's circle, or undefined if no fill. */
  backgroundColor: string | undefined;
}

export interface BuildDayCellsInput {
  scheduledDaysMask: number;
  /**
   * Days where every scheduled time-slot for that day-of-week has a check-in.
   * Per the new partial-aware semantic this is full completion, not
   * "any check-in" — for partial completion pass `partialDaysMask`.
   */
  checkedInDaysMask: number;
  /**
   * Days where some — but not all — of that day's scheduled time-slots have a
   * check-in. Painted with `partialColor` (typically orange) instead of
   * the green `checkedInColor`. Pass alongside `checkedInDaysMask` from
   * `classifyScheduledDays`.
   */
  partialDaysMask?: number;
  /**
   * Days that have at least one check-in, *regardless* of the schedule.
   * Lets unscheduled days still show a fill when the user checked in,
   * so a Tuesday check-in on a Mon/Wed habit isn't invisible. Callers
   * render these cells dimmed (via the `scheduled: false` flag) to match
   * the faded letter.
   */
  anyCheckInDaysMask?: number;
  /** Color used for fully-completed scheduled days (e.g. green). */
  checkedInColor: string;
  /** Color used for partially-completed past scheduled days (orange). */
  partialColor?: string;
  /** Optional override color for today's circle (e.g. partial/failing). */
  todayColor?: string;
  /** Color for past scheduled days with no check-in (e.g. red). */
  missedColor?: string;
  now?: Date;
}

/**
 * Builds a Monday-first row of day cell descriptors for a habit tile,
 * combining the schedule mask, check-in mask, and today's compliance
 * color into a flat shape ready for rendering.
 */
export const buildDayCells = ({
  scheduledDaysMask,
  checkedInDaysMask,
  partialDaysMask = 0,
  anyCheckInDaysMask = 0,
  checkedInColor,
  partialColor,
  todayColor,
  missedColor,
  now = new Date(),
}: BuildDayCellsInput): DayCell[] => {
  const todayBit = 1 << now.getDay();
  const todayIndex = mondayFirstDayLetters.findIndex(
    ({ day }) => day === todayBit,
  );
  return mondayFirstDayLetters.map(({ day, letter }, index) => {
    const scheduled = (scheduledDaysMask & day) !== 0;
    const checkedIn = scheduled && (checkedInDaysMask & day) !== 0;
    const partial = scheduled && (partialDaysMask & day) !== 0;
    const unscheduledCheckIn = !scheduled && (anyCheckInDaysMask & day) !== 0;
    const isToday = day === todayBit;
    const isPast = index < todayIndex;
    // A fully checked-in today should stay green — the blue "action needed"
    // todayColor would misrepresent a completed day. Partial/missed today
    // still gets the override since the day isn't done yet.
    const todayOverride =
      isToday && scheduled && !checkedIn ? todayColor : undefined;
    const missed = scheduled && isPast && !checkedIn && !partial;
    // Partial-with-no-partialColor falls back to checkedInColor: the day
    // does have at least one check-in, so painting it `missedColor` would
    // misrepresent the data. (Callers that haven't opted into partial-aware
    // UI thus get the legacy "any check-in = green" behaviour.)
    const backgroundColor =
      todayOverride ??
      (checkedIn
        ? checkedInColor
        : partial
          ? isPast && partialColor
            ? partialColor
            : checkedInColor
          : unscheduledCheckIn
            ? checkedInColor
            : missed
              ? missedColor
              : undefined);
    return { letter, scheduled, backgroundColor };
  });
};

/**
 * Returns a day-of-week bitmask (Sun=bit0..Sat=bit6) covering every day
 * that has at least one check-in in the supplied list. Used for
 * unscheduled weekly goals so their board card can highlight the days
 * a user actually checked in on.
 */
export const checkInDaysMask = (checkIns: { timestamp: Date }[]): number =>
  checkIns.reduce((mask, c) => mask | (1 << c.timestamp.getDay()), 0);

/**
 * Day-of-week bitmask (Sun=bit0..Sat=bit6) of days that have at least one
 * check-in and where *every* check-in is a skip — i.e. the day was
 * intentionally set aside. Unlike `classifyScheduledDays`'s
 * `skippedDaysMask` (scheduled days only), this also covers off-days and
 * frequency-only days, so a skip the user logged on an unscheduled day
 * still reads as "set aside" rather than a plain check-in.
 */
export const fullySkippedDaysMask = (
  checkIns: { timestamp: Date; skipped?: boolean | null }[],
): number => {
  const seen = Array.from({ length: 7 }, () => false);
  const done = Array.from({ length: 7 }, () => false);
  for (const c of checkIns) {
    const dow = c.timestamp.getDay();
    seen[dow] = true;
    if (!c.skipped) done[dow] = true;
  }
  let mask = 0;
  for (let dow = 0; dow < 7; dow++) {
    if (seen[dow] && !done[dow]) mask |= 1 << dow;
  }
  return mask;
};

export interface TimeSlotCompletion {
  /** Days where check-ins meet or exceed that day's scheduled time-slot count. */
  completedDaysMask: number;
  /** Days where 0 < check-ins < scheduled time-slot count. */
  partialDaysMask: number;
  /**
   * Days where the user has at least one skipped check-in and no non-skip
   * check-ins — i.e. the day was intentionally set aside. Such days may
   * also be in `completedDaysMask` (skips still cover the schedule), so
   * renderers that care about the distinction should check `skippedDaysMask`
   * first.
   */
  skippedDaysMask: number;
}

/**
 * Classifies each day-of-week as complete / partial / neither, given a
 * habit's schedules and the check-ins in the period. Use the returned
 * masks for `buildDayCells`'s `checkedInDaysMask` + `partialDaysMask`
 * so per-day cells reflect partial completion (e.g. 2 of 3 scheduled
 * time-slots done → orange instead of green).
 */
export const classifyScheduledDays = ({
  schedules,
  checkIns,
}: {
  schedules: ScheduleInfo[];
  checkIns: { timestamp: Date; skipped?: boolean | null }[];
}): TimeSlotCompletion => {
  const timeSlotsByDay: number[] = Array.from({ length: 7 }, () => 0);
  for (const s of schedules) {
    if (s.hour === null || s.hour === undefined) continue;
    const days = s.days ?? 0;
    for (let dow = 0; dow < 7; dow++) {
      const bit = 1 << dow;
      // `days === 0` means "every day" (matches existing matchers).
      if (days === 0 || (days & bit) !== 0) {
        timeSlotsByDay[dow] += 1;
      }
    }
  }
  const checkInsByDay: number[] = Array.from({ length: 7 }, () => 0);
  const skipsByDay: number[] = Array.from({ length: 7 }, () => 0);
  for (const c of checkIns) {
    const dow = c.timestamp.getDay();
    checkInsByDay[dow] += 1;
    if (c.skipped) skipsByDay[dow] += 1;
  }
  let completedDaysMask = 0;
  let partialDaysMask = 0;
  let skippedDaysMask = 0;
  for (let dow = 0; dow < 7; dow++) {
    const bit = 1 << dow;
    const timeSlots = timeSlotsByDay[dow];
    const done = checkInsByDay[dow];
    if (timeSlots === 0) continue;
    if (done >= timeSlots) completedDaysMask |= bit;
    else if (done > 0) partialDaysMask |= bit;
    const nonSkip = done - skipsByDay[dow];
    if (skipsByDay[dow] > 0 && nonSkip === 0) skippedDaysMask |= bit;
  }
  return { completedDaysMask, partialDaysMask, skippedDaysMask };
};
