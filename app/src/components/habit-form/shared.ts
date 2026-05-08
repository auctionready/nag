import type { Regularity } from "@nag/schema";
import { AllDays } from "@nag/core";
import type { HabitIconKind } from "../glyphs";

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

/** Form values are strings; coerce, falling back to 9:00 for empties / NaN. */
export const parseFormTime = (
  hour: string,
  minute: string,
): { hour: number; minute: number } => ({
  hour: Number(hour) || 9,
  minute: Number(minute) || 0,
});

export const timeFromStrings = (hour: string, minute: string): Date => {
  const { hour: h, minute: m } = parseFormTime(hour, minute);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
};
