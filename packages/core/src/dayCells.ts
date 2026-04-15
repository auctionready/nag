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
   * Days where every scheduled slot for that day-of-week has a check-in.
   * Per the new partial-aware semantic this is full completion, not
   * "any check-in" — for partial completion pass `partialDaysMask`.
   */
  checkedInDaysMask: number;
  /**
   * Days where some — but not all — of that day's scheduled slots have a
   * check-in. Painted with `partialColor` (typically orange) instead of
   * the green `checkedInColor`. Pass alongside `checkedInDaysMask` from
   * `classifyScheduledDays`.
   */
  partialDaysMask?: number;
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
    const isToday = day === todayBit;
    const isPast = index < todayIndex;
    const todayOverride = isToday && scheduled ? todayColor : undefined;
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
          : missed
            ? missedColor
            : undefined);
    return { letter, scheduled, backgroundColor };
  });
};

export interface SlotCompletion {
  /** Days where check-ins meet or exceed that day's scheduled slot count. */
  completedDaysMask: number;
  /** Days where 0 < check-ins < scheduled slot count. */
  partialDaysMask: number;
}

/**
 * Classifies each day-of-week as complete / partial / neither, given a
 * habit's schedules and the check-ins in the period. Use the returned
 * masks for `buildDayCells`'s `checkedInDaysMask` + `partialDaysMask`
 * so per-day cells reflect partial completion (e.g. 2 of 3 scheduled
 * slots done → orange instead of green).
 */
export const classifyScheduledDays = ({
  schedules,
  checkIns,
}: {
  schedules: ScheduleInfo[];
  checkIns: { timestamp: Date }[];
}): SlotCompletion => {
  const slotsByDay: number[] = new Array(7).fill(0);
  for (const s of schedules) {
    if (s.hour === null || s.hour === undefined) continue;
    const days = s.days ?? 0;
    for (let dow = 0; dow < 7; dow++) {
      const bit = 1 << dow;
      // `days === 0` means "every day" (matches existing matchers).
      if (days === 0 || (days & bit) !== 0) {
        slotsByDay[dow] += 1;
      }
    }
  }
  const checkInsByDay: number[] = new Array(7).fill(0);
  for (const c of checkIns) {
    checkInsByDay[c.timestamp.getDay()] += 1;
  }
  let completedDaysMask = 0;
  let partialDaysMask = 0;
  for (let dow = 0; dow < 7; dow++) {
    const bit = 1 << dow;
    const slots = slotsByDay[dow];
    const done = checkInsByDay[dow];
    if (slots === 0) continue;
    if (done >= slots) completedDaysMask |= bit;
    else if (done > 0) partialDaysMask |= bit;
  }
  return { completedDaysMask, partialDaysMask };
};
