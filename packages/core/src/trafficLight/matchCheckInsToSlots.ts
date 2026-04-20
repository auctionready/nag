import { isSameCalendarDay } from "../days";
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

/**
 * Given today's timed schedules and today's check-ins, pair them up
 * by closest time-of-day and return the status of each slot.
 *
 * Slots without `hour` are ignored. Schedules whose `days` mask
 * excludes today are ignored. A null/zero `days` value is treated as
 * applying every day (consistent with `withinDayCompliance`).
 *
 * Pairing: each check-in is assigned to the unmatched slot whose
 * time-of-day is closest to the check-in's `timestamp` (the "deemed
 * slot time" — see docs/Intro.md § "Deemed time vs. recording time").
 * Check-ins are processed in chronological order; ties are broken by
 * the earlier slot. Back-filled check-ins — whose timestamp is set to
 * the slot's exact hour/minute — land on their intended slot even when
 * other check-ins are missing or were removed.
 *
 * A check-in with `skipped = true` marks its slot as "skipped" rather
 * than "done". Unmatched slots whose time has passed are "missed";
 * future slots are "upcoming". Check-ins with no slot to claim (more
 * check-ins than slots) are counted as `extras`.
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
    .filter((c) => isSameCalendarDay(c.timestamp, now))
    .slice()
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  // Nearest-time assignment: for each check-in (in time order), claim
  // the unmatched slot whose time-of-day is closest. Iterating
  // `availableSlots` in insertion order (which is chronological, since
  // we sorted) means ties go to the earlier slot.
  const matchedBySlot = new Map<
    number,
    { timestamp: Date; skipped?: boolean | null }
  >();
  const availableSlots = new Set<number>(todaysSlots.map((_, i) => i));
  for (const checkIn of todaysCheckIns) {
    if (availableSlots.size === 0) break;
    const checkInMinutes =
      checkIn.timestamp.getHours() * 60 + checkIn.timestamp.getMinutes();
    let bestIdx = -1;
    let bestDist = Infinity;
    for (const i of availableSlots) {
      const slot = todaysSlots[i];
      const dist = Math.abs(checkInMinutes - (slot.hour * 60 + slot.minute));
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = i;
      }
    }
    matchedBySlot.set(bestIdx, checkIn);
    availableSlots.delete(bestIdx);
  }

  const slots: SlotState[] = todaysSlots.map((slot, i) => {
    const match = matchedBySlot.get(i);
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
