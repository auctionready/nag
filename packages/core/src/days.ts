import { set } from "date-fns";

export enum Day {
  Sun = 1 << 0,
  Mon = 1 << 1,
  Tue = 1 << 2,
  Wed = 1 << 3,
  Thu = 1 << 4,
  Fri = 1 << 5,
  Sat = 1 << 6,
}

export const NoDays = 0;

export const AllDays =
  Day.Sun | Day.Mon | Day.Tue | Day.Wed | Day.Thu | Day.Fri | Day.Sat;

export const WeekDays = Day.Mon | Day.Tue | Day.Wed | Day.Thu | Day.Fri;
export const WeekendDays = Day.Sat | Day.Sun;

const dayNames: Readonly<Record<Day, string>> = Object.freeze({
  [Day.Sun]: "Sun",
  [Day.Mon]: "Mon",
  [Day.Tue]: "Tue",
  [Day.Wed]: "Wed",
  [Day.Thu]: "Thu",
  [Day.Fri]: "Fri",
  [Day.Sat]: "Sat",
});

/** Full weekday titles keyed by the `Day` enum bit. */
export const dayTitles: Readonly<Record<Day, string>> = Object.freeze({
  [Day.Sun]: "Sunday",
  [Day.Mon]: "Monday",
  [Day.Tue]: "Tuesday",
  [Day.Wed]: "Wednesday",
  [Day.Thu]: "Thursday",
  [Day.Fri]: "Friday",
  [Day.Sat]: "Saturday",
});

export const WeekdayNames: readonly string[] = Object.freeze(
  Object.values(dayNames),
);

const mondayFirstDays: readonly Day[] = Object.freeze([
  Day.Mon,
  Day.Tue,
  Day.Wed,
  Day.Thu,
  Day.Fri,
  Day.Sat,
  Day.Sun,
]);

export const weekDayEntries: readonly {
  readonly day: Day;
  readonly label: string;
}[] = Object.freeze(
  mondayFirstDays.map((day) => Object.freeze({ day, label: dayNames[day] })),
);

export const mondayFirstDayLetters: readonly {
  readonly day: Day;
  readonly letter: string;
}[] = Object.freeze(
  mondayFirstDays.map((day) =>
    Object.freeze({ day, letter: dayNames[day][0] }),
  ),
);

export const isSameCalendarDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

/**
 * A `Date` on the same calendar day as `day`, at the given wall-clock time
 * (seconds/milliseconds zeroed). DST-safe — keeps the intended local hour
 * across transitions, unlike millisecond arithmetic.
 */
export const atTimeOfDay = (day: Date, hour: number, minute: number): Date =>
  set(day, { hours: hour, minutes: minute, seconds: 0, milliseconds: 0 });

/**
 * Whether a schedule `days` bitmask applies on the weekday of `date`.
 * A null/zero mask means "every day" (consistent with `withinDayCompliance`).
 */
export const appliesOnDay = (
  days: number | null | undefined,
  date: Date,
): boolean => {
  const mask = days ?? 0;
  return mask === 0 || (mask & (1 << date.getDay())) !== 0;
};
