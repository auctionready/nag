import { isSameCalendarDay } from "./days";
import type { ScheduleInfo } from "./trafficLight/types";

export type DayAgendaItemStatus =
  | "overdue"
  | "upcoming"
  | "done"
  | "skip"
  | "missed"
  | "scheduled"
  | "unscheduled";

export type DayMode = "past" | "today" | "future";

/** Minimum habit shape needed to label an agenda row. */
export interface DayAgendaHabit {
  id: string;
  title: string;
  /** Icon kind from the habit (open string — app maps to glyph set). */
  icon: string | null;
}

/** One row in the cross-habit day agenda the UI renders. */
export interface DayAgendaItem {
  /** Stable list key. */
  key: string;
  habitId: string;
  habitTitle: string;
  habitIcon: string | null;
  status: DayAgendaItemStatus;
  /** Scheduled hour/minute of the slot, when one exists. */
  slotHour?: number;
  slotMinute?: number;
  /** Existing check-in id, when status is done/skip. */
  checkInId?: string;
  /** When the check-in was logged (done/skip). */
  loggedAt?: Date;
}

/** Cross-habit day agenda — every habit's slots and extras flattened. */
export interface DayAgenda {
  items: DayAgendaItem[];
  mode: DayMode;
}

/** Pre-grouped lookups consumed by {@link createGetDayAgenda}. */
export interface DayAgendaLookups {
  habits: DayAgendaHabit[];
  schedulesByHabit: ReadonlyMap<string, ScheduleInfo[]>;
  checkInsByHabit: ReadonlyMap<
    string,
    { id: string; timestamp: Date; skipped: boolean }[]
  >;
}

export interface DayAgendaSlot {
  hour: number;
  minute: number;
  status: DayAgendaItemStatus;
  /** Timestamp of the matched check-in, when status is "done" or "skip". */
  matchedAt?: Date;
}

export interface DayAgendaExtra {
  timestamp: Date;
  skipped: boolean;
}

export interface BuildDayAgendaInput {
  schedules: ScheduleInfo[];
  checkIns: { timestamp: Date; skipped?: boolean | null }[];
  day: Date;
  now: Date;
}

export interface DayAgendaResult {
  /** Scheduled time-slots for the day in chronological order. */
  slots: DayAgendaSlot[];
  /** Check-ins on the day that didn't claim a scheduled slot. */
  extras: DayAgendaExtra[];
  /** Whether the day is before, equal to, or after `now`'s calendar day. */
  mode: DayMode;
}

const startOfCalendarDay = (d: Date): Date =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate());

/**
 * Build the per-day agenda for one habit. Pairs the day's check-ins to the
 * habit's scheduled time-slots by nearest time-of-day (same algorithm as
 * `matchCheckInsToTimeSlots`), then classifies each slot by the day's
 * relationship to `now`:
 *
 *   - past:    matched → done/skip · unmatched → missed
 *   - today:   matched → done/skip · unmatched → overdue (past time) or upcoming
 *   - future:  matched → done/skip · unmatched → scheduled
 *
 * Check-ins beyond the number of slots fall into `extras`.
 */
export const buildDayAgenda = ({
  schedules,
  checkIns,
  day,
  now,
}: BuildDayAgendaInput): DayAgendaResult => {
  const today = startOfCalendarDay(now);
  const target = startOfCalendarDay(day);
  const mode: DayMode =
    target.getTime() < today.getTime()
      ? "past"
      : target.getTime() === today.getTime()
        ? "today"
        : "future";

  const dayBit = 1 << day.getDay();
  const daySlots = schedules
    .filter((s) => s.hour !== null && s.hour !== undefined)
    .filter((s) => {
      const days = s.days ?? 0;
      return days === 0 || (days & dayBit) !== 0;
    })
    .map((s) => ({ hour: s.hour as number, minute: s.minute ?? 0 }))
    .sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute));

  const dayCheckIns = checkIns
    .filter((c) => isSameCalendarDay(c.timestamp, day))
    .slice()
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  const matched = new Map<
    number,
    { timestamp: Date; skipped?: boolean | null }
  >();
  const available = new Set<number>(daySlots.map((_, i) => i));
  for (const c of dayCheckIns) {
    if (available.size === 0) break;
    const cMin = c.timestamp.getHours() * 60 + c.timestamp.getMinutes();
    let bestIdx = -1;
    let best = Infinity;
    for (const i of available) {
      const s = daySlots[i];
      const dist = Math.abs(cMin - (s.hour * 60 + s.minute));
      if (dist < best) {
        best = dist;
        bestIdx = i;
      }
    }
    matched.set(bestIdx, c);
    available.delete(bestIdx);
  }

  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const slots: DayAgendaSlot[] = daySlots.map((slot, i) => {
    const m = matched.get(i);
    if (m) {
      return {
        hour: slot.hour,
        minute: slot.minute,
        status: m.skipped ? "skip" : "done",
        matchedAt: m.timestamp,
      };
    }
    if (mode === "past") {
      return { hour: slot.hour, minute: slot.minute, status: "missed" };
    }
    if (mode === "future") {
      return { hour: slot.hour, minute: slot.minute, status: "scheduled" };
    }
    const slotMin = slot.hour * 60 + slot.minute;
    return {
      hour: slot.hour,
      minute: slot.minute,
      status: slotMin <= nowMinutes ? "overdue" : "upcoming",
    };
  });

  const matchedCheckIns = new Set(
    Array.from(matched.values()).map((c) => c.timestamp.getTime()),
  );
  const extras: DayAgendaExtra[] = dayCheckIns
    .filter((c) => !matchedCheckIns.has(c.timestamp.getTime()))
    .map((c) => ({ timestamp: c.timestamp, skipped: !!c.skipped }));

  return { slots, extras, mode };
};

/**
 * Factory that closes over `lookups` and returns a `(day, now)` function
 * producing the cross-habit day agenda. Iterates every habit, runs
 * {@link buildDayAgenda}, and flattens the per-habit slots + extras into a
 * single list ready for the UI. Matched check-ins keep their `id` so the
 * UI can offer undo without an extra lookup.
 *
 * `now` is taken as a parameter (not closed over) so the same factory
 * instance can be called repeatedly across the day without going stale.
 */
export const createGetDayAgenda =
  ({ habits, schedulesByHabit, checkInsByHabit }: DayAgendaLookups) =>
  (day: Date, now: Date): DayAgenda => {
    const items: DayAgendaItem[] = [];
    let mode: DayMode = "today";
    for (const habit of habits) {
      const habitSchedules = schedulesByHabit.get(habit.id) ?? [];
      const habitCheckIns = checkInsByHabit.get(habit.id) ?? [];
      const result = buildDayAgenda({
        schedules: habitSchedules,
        checkIns: habitCheckIns,
        day,
        now,
      });
      mode = result.mode;
      // Map matched timestamps back to their check-in id so the UI can
      // undo without a second lookup. Built per-habit (small N) — no
      // need to index across habits.
      const checkInById = new Map(
        habitCheckIns
          .filter((c) => isSameCalendarDay(c.timestamp, day))
          .map((c) => [c.timestamp.getTime(), c.id] as const),
      );
      result.slots.forEach((slot, i) => {
        items.push({
          key: `${habit.id}::slot::${i}`,
          habitId: habit.id,
          habitTitle: habit.title,
          habitIcon: habit.icon,
          status: slot.status,
          slotHour: slot.hour,
          slotMinute: slot.minute,
          checkInId: slot.matchedAt
            ? checkInById.get(slot.matchedAt.getTime())
            : undefined,
          loggedAt: slot.matchedAt,
        });
      });
      result.extras.forEach((extra, i) => {
        items.push({
          key: `${habit.id}::extra::${i}`,
          habitId: habit.id,
          habitTitle: habit.title,
          habitIcon: habit.icon,
          status: extra.skipped ? "skip" : "done",
          checkInId: checkInById.get(extra.timestamp.getTime()),
          loggedAt: extra.timestamp,
        });
      });
      // Unscheduled habits — a goal with no schedule rows pinning it to a
      // day/time — never produce slots, so they're otherwise invisible on the
      // agenda. With no schedule, *any* day is a valid day to log them, so on
      // today and past days surface a single actionable row when nothing's been
      // logged yet (a logged check-in already shows above as a "done" extra),
      // letting the user check it off ad-hoc. Future days stay read-only —
      // there's nothing to log ahead of time.
      if (
        habitSchedules.length === 0 &&
        result.mode !== "future" &&
        result.extras.length === 0
      ) {
        items.push({
          key: `${habit.id}::unscheduled`,
          habitId: habit.id,
          habitTitle: habit.title,
          habitIcon: habit.icon,
          status: "unscheduled",
        });
      }
    }
    return { items, mode };
  };

/**
 * The timestamp to record when logging (check-in or skip) `item` on `day`.
 *
 * Slotted items record at their slot's *deemed* time (the scheduled
 * hour/minute), NOT wall-clock `now`. This is essential when a habit has
 * several slots in one day: {@link buildDayAgenda} pairs check-ins to slots
 * by nearest time-of-day, so recording an overdue 9am dose at 12:30 would
 * otherwise land on a 1pm slot — marking the wrong slot done and leaving the
 * overdue one overdue. Recording at the slot's exact time pins it to the
 * intended slot (distance 0).
 *
 * Slotless items (ad-hoc extras, unscheduled habits) have no deemed time.
 * Logged on today they record at `now` (carrying the real wall-clock time);
 * logged on another day — backfilling an unscheduled habit on a past day —
 * they pin to noon of that day so the check-in lands on the day being viewed,
 * not today.
 */
export const agendaCheckInTime = (
  item: Pick<DayAgendaItem, "slotHour" | "slotMinute">,
  day: Date,
  now: Date,
): Date => {
  if (item.slotHour === undefined || item.slotMinute === undefined) {
    if (isSameCalendarDay(day, now)) return now;
    return new Date(day.getFullYear(), day.getMonth(), day.getDate(), 12, 0);
  }
  return new Date(
    day.getFullYear(),
    day.getMonth(),
    day.getDate(),
    item.slotHour,
    item.slotMinute,
  );
};
