import type { Regularity } from "@nag/schema";
import { AllDays, NoDays, Day } from "./days";

export type FormRegularity = Regularity | "none" | "scheduled";

export type ScheduleEntry = {
  hour: string;
  minute: string;
  days?: number;
};

export type HabitFormData = {
  title: string;
  description: string;
  regularity: FormRegularity;
  frequency: string;
  schedules: ScheduleEntry[];
};

export interface HabitFormProps {
  initialValues?: Partial<HabitFormData>;
  onSubmit: (data: HabitFormData) => Promise<void>;
  onDelete?: () => void;
}

export const defaultValues: HabitFormData = {
  title: "",
  description: "",
  regularity: "none",
  frequency: "1",
  schedules: [{ hour: "9", minute: "00", days: AllDays }],
};

export const formRegularityValues: FormRegularity[] = [
  "none",
  "day",
  "week",
  "month",
  "scheduled",
];

export const regularityLabels: Record<FormRegularity, string> = {
  none: "Ad-hoc",
  day: "Daily",
  week: "Weekly",
  month: "Monthly",
  scheduled: "Scheduled",
};

export const dayEntries: { day: Day; label: string }[] = [
  { day: Day.Sun, label: "Sun" },
  { day: Day.Mon, label: "Mon" },
  { day: Day.Tue, label: "Tue" },
  { day: Day.Wed, label: "Wed" },
  { day: Day.Thu, label: "Thu" },
  { day: Day.Fri, label: "Fri" },
  { day: Day.Sat, label: "Sat" },
];

export function timeFromStrings(hour: string, minute: string): Date {
  const d = new Date();
  d.setHours(Number(hour) || 9, Number(minute) || 0, 0, 0);
  return d;
}

export function formatTime(hour: string, minute: string): string {
  const h = Number(hour) || 9;
  const m = String(Number(minute) || 0).padStart(2, "0");
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${m} ${period}`;
}

export function formatDays(days: number): string {
  if (days === NoDays) return "No days";
  if (days === AllDays) return "Every day";
  return dayEntries
    .filter(({ day }) => days & day)
    .map(({ label }) => label)
    .join(", ");
}
