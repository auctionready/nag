import type { ScheduleInfo } from "./types";

export type SlotStatus = "done" | "skipped" | "missed" | "upcoming";

export interface SlotState {
  hour: number;
  minute: number;
  status: SlotStatus;
  /** Timestamp of the matched check-in, when status is "done" or "skipped". */
  matchedAt?: Date;
}

export interface MatchCheckInsToSlotsInput {
  schedules: ScheduleInfo[];
  checkIns: { timestamp: Date; skipped?: boolean | null }[];
  now: Date;
}

export interface MatchCheckInsToSlotsResult {
  slots: SlotState[];
  /** Check-ins today beyond the number of slots (e.g. spontaneous extra). */
  extras: number;
  /** Count of slots with status "done" (excludes skipped). */
  done: number;
  /** Count of timed slots scheduled for today. */
  total: number;
}

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

/**
 * Given today's timed schedules and today's check-ins, pair them up
 * greedily in chronological order and return the status of each slot.
 *
 * Slots without `hour` are ignored. Schedules whose `days` mask
 * excludes today are ignored. A null/zero `days` value is treated as
 * applying every day (consistent with `withinDayCompliance`).
 *
 * Greedy pairing: the `i`-th check-in (by timestamp) fills the `i`-th
 * slot (by time). A check-in with `skipped = true` marks its slot as
 * "skipped" rather than "done". Unmatched slots whose time has passed
 * are "missed"; future slots are "upcoming".
 */
export const matchCheckInsToSlots = ({
  schedules,
  checkIns,
  now,
}: MatchCheckInsToSlotsInput): MatchCheckInsToSlotsResult => {
  const todayBit = 1 << now.getDay();
  const todaysSlots = schedules
    .filter((s) => {
      if (s.hour === null || s.hour === undefined) return false;
      const days = s.days ?? 0;
      return days === 0 || (days & todayBit) !== 0;
    })
    .map((s) => ({ hour: s.hour as number, minute: s.minute ?? 0 }))
    .sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute));

  const todaysCheckIns = checkIns
    .filter((c) => isSameDay(c.timestamp, now))
    .slice()
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const slots: SlotState[] = todaysSlots.map((slot, i) => {
    const match = todaysCheckIns[i];
    if (match) {
      return {
        hour: slot.hour,
        minute: slot.minute,
        status: match.skipped ? "skipped" : "done",
        matchedAt: match.timestamp,
      };
    }
    const elapsed = slot.hour * 60 + slot.minute <= nowMinutes;
    return {
      hour: slot.hour,
      minute: slot.minute,
      status: elapsed ? "missed" : "upcoming",
    };
  });

  const extras = Math.max(0, todaysCheckIns.length - todaysSlots.length);
  const done = slots.filter((s) => s.status === "done").length;

  return { slots, extras, done, total: todaysSlots.length };
};
