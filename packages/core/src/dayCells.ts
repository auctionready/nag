import { mondayFirstDayLetters } from "./days";

export interface DayCell {
  letter: string;
  scheduled: boolean;
  /** Background color for the day's circle, or undefined if no fill. */
  backgroundColor: string | undefined;
}

export interface BuildDayCellsInput {
  scheduledDaysMask: number;
  checkedInDaysMask: number;
  /** Color used for plain checked-in days (e.g. green). */
  checkedInColor: string;
  /** Optional override color for today's circle (e.g. partial/failing). */
  todayColor?: string;
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
  checkedInColor,
  todayColor,
  now = new Date(),
}: BuildDayCellsInput): DayCell[] => {
  const todayBit = 1 << now.getDay();
  return mondayFirstDayLetters.map(({ day, letter }) => {
    const scheduled = (scheduledDaysMask & day) !== 0;
    const checkedIn = scheduled && (checkedInDaysMask & day) !== 0;
    const isToday = day === todayBit;
    const todayOverride = isToday && scheduled ? todayColor : undefined;
    const backgroundColor =
      todayOverride ?? (checkedIn ? checkedInColor : undefined);
    return { letter, scheduled, backgroundColor };
  });
};
