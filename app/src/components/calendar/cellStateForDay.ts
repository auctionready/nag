import type { CellState } from "../habit-detail/CellGlyph";

export type DayKind = "past" | "today" | "future";

export interface CellStateInput {
  /** Check-ins on this habit on this day (just the skipped flag is needed). */
  checkIns: { skipped: boolean }[];
  /** Bitmask of weekday schedules; 0 means "no schedule at all" (frequency-only). */
  scheduledDaysMask: number;
  /** Per-day target frequency (best-effort: weekly/monthly habits round down to 1). */
  frequency: number;
  /** 0 = Sunday … 6 = Saturday. */
  dayOfWeek: number;
  dayKind: DayKind;
}

/**
 * Classify one habit-day cell for the week grid. Mirrors the language used
 * by the home-tile day cells: done · partial · missed · skipped · today ·
 * today-partial · today-done · future · unscheduled.
 *
 *  - future days are always `future`
 *  - today maps to `today` / `today-partial` / `today-done`
 *  - past scheduled-off days are `unscheduled` (negative space, not "missed")
 *  - past scheduled days are `done` / `partial` / `missed` / `skipped`
 */
export const cellStateForDay = ({
  checkIns,
  scheduledDaysMask,
  frequency,
  dayOfWeek,
  dayKind,
}: CellStateInput): CellState => {
  if (dayKind === "future") return "future";

  const dayBit = 1 << dayOfWeek;
  const isScheduledDay =
    scheduledDaysMask === 0 || (scheduledDaysMask & dayBit) !== 0;

  const total = checkIns.length;
  const skipped = checkIns.reduce((n, c) => n + (c.skipped ? 1 : 0), 0);
  const done = total - skipped;
  const target = Math.max(1, frequency);

  if (dayKind === "today") {
    if (done >= target) return "today-done";
    if (done > 0) return "today-partial";
    return "today";
  }

  // past
  if (done >= target) return "done";
  if (done > 0) return "partial";
  if (total > 0 && skipped === total) return "skipped";
  if (isScheduledDay) return "missed";
  return "unscheduled";
};
