import type { Regularity } from "@nag/schema";

export const periodLabels: Record<Regularity, string> = {
  day: "today",
  week: "this week",
  month: "this month",
};

const smallNumbers = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
];

export const formatCount = (n: number): string =>
  n < smallNumbers.length ? smallNumbers[n] : String(n);
