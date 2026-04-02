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
