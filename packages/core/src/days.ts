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

const dayNames: Readonly<Record<Day, string>> = Object.freeze({
  [Day.Sun]: "Sun",
  [Day.Mon]: "Mon",
  [Day.Tue]: "Tue",
  [Day.Wed]: "Wed",
  [Day.Thu]: "Thu",
  [Day.Fri]: "Fri",
  [Day.Sat]: "Sat",
});

export const WeekdayNames: readonly string[] = Object.freeze(
  Object.values(dayNames),
);

export const weekDayEntries: readonly {
  readonly day: Day;
  readonly label: string;
}[] = Object.freeze(
  Object.entries(dayNames).map(([day, label]) =>
    Object.freeze({ day: Number(day) as Day, label }),
  ),
);

export const mondayFirstDayLetters: readonly {
  readonly day: Day;
  readonly letter: string;
}[] = Object.freeze([
  Object.freeze({ day: Day.Mon, letter: "M" }),
  Object.freeze({ day: Day.Tue, letter: "T" }),
  Object.freeze({ day: Day.Wed, letter: "W" }),
  Object.freeze({ day: Day.Thu, letter: "T" }),
  Object.freeze({ day: Day.Fri, letter: "F" }),
  Object.freeze({ day: Day.Sat, letter: "S" }),
  Object.freeze({ day: Day.Sun, letter: "S" }),
]);
