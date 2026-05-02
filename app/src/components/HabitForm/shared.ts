import type { Regularity } from "@nag/schema";
import { AllDays, Day, NoDays, weekDayEntries } from "@nag/core";
import type { HabitIconKind } from "../HabitGlyph";

export type FormRegularity = Regularity | "none" | "scheduled";

export type ScheduleEntry = {
  hour: string;
  minute: string;
  days?: number;
  reminder?: boolean;
};

export type HabitFormData = {
  title: string;
  description: string;
  icon: HabitIconKind | null;
  regularity: FormRegularity;
  frequency: string;
  schedules: ScheduleEntry[];
};

export interface HabitFormProps {
  initialValues?: Partial<HabitFormData>;
  onSubmit: (data: HabitFormData) => Promise<void>;
  onDelete?: () => void;
  mode?: "create" | "edit";
}

export const defaultValues: HabitFormData = {
  title: "",
  description: "",
  icon: null,
  regularity: "none",
  frequency: "1",
  schedules: [{ hour: "9", minute: "00", days: AllDays, reminder: true }],
};

export const formRegularityValues: FormRegularity[] = [
  "none",
  "day",
  "week",
  "month",
  "scheduled",
];

export const regularityLabels: Record<FormRegularity, string> = {
  none: "ad-hoc",
  day: "daily",
  week: "weekly",
  month: "monthly",
  scheduled: "scheduled",
};

// Sub-control labels per cadence (matches design's contextual sub-control).
export const frequencySuffix: Record<"day" | "week" | "month", string> = {
  day: "times per day",
  week: "times per week",
  month: "times per month",
};

// 24-glyph palette shown in the icon picker. Matches habit-icons in the
// design bundle. Order is intentional — most common up top.
export const HABIT_ICON_KINDS: HabitIconKind[] = [
  "run",
  "walk",
  "bike",
  "gym",
  "yoga",
  "meditate",
  "water",
  "pill",
  "sleep",
  "book",
  "pen",
  "guitar",
  "leaf",
  "sun",
  "fork",
  "fast",
  "coffee",
  "phone",
  "money",
  "language",
  "broom",
  "heart",
  "mountain",
  "check",
];

export const timeFromStrings = (hour: string, minute: string): Date => {
  const d = new Date();
  d.setHours(Number(hour) || 9, Number(minute) || 0, 0, 0);
  return d;
};

export const formatTime = (hour: string, minute: string): string => {
  const h = Number(hour) || 9;
  const m = String(Number(minute) || 0).padStart(2, "0");
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${m} ${period}`;
};

export const formatDays = (days: number): string => {
  if (days === NoDays) return "No days";
  if (days === AllDays) return "Every day";
  return weekDayEntries
    .filter(({ day }) => days & day)
    .map(({ label }) => label)
    .join(", ");
};

// Smart day summary for the schedule entry row. Returns a friendly label
// when the day mask is "every day" / "weekdays" / "weekends", otherwise
// `null` (caller renders day pills inline).
const WEEKDAYS_MASK = Day.Mon | Day.Tue | Day.Wed | Day.Thu | Day.Fri;
const WEEKENDS_MASK = Day.Sat | Day.Sun;

export const friendlyDaysLabel = (days: number): string | null => {
  if (days === NoDays) return "no days";
  if (days === AllDays) return "every day";
  if (days === WEEKDAYS_MASK) return "weekdays";
  if (days === WEEKENDS_MASK) return "weekends";
  return null;
};
