import { appliesOnDay, isSameCalendarDay } from "../days";
import type { ScheduleInfo } from "./types";

export type TimeSlotStatus = "done" | "skipped" | "missed" | "upcoming";

export interface TimeSlotState {
  hour: number;
  minute: number;
  status: TimeSlotStatus;
  /** Timestamp of the matched check-in, when status is "done" or "skipped". */
  matchedAt?: Date;
}

export interface MatchCheckInsToTimeSlotsInput {
  schedules: ScheduleInfo[];
  checkIns: { timestamp: Date; skipped?: boolean | null }[];
  now: Date;
}

export interface MatchCheckInsToTimeSlotsResult {
  timeSlots: TimeSlotState[];
  /** Check-ins today beyond the number of time-slots (e.g. spontaneous extra). */
  extras: number;
  /** Count of time-slots with status "done" (excludes skipped). */
  done: number;
  /** Count of timed time-slots scheduled for today. */
  total: number;
}

/**
 * Given today's timed schedules and today's check-ins, pair them up
 * by closest time-of-day and return the status of each time-slot.
 *
 * Time-slots without `hour` are ignored. Schedules whose `days` mask
 * excludes today are ignored. A null/zero `days` value is treated as
 * applying every day (consistent with `withinDayCompliance`).
 *
 * Pairing: each check-in is assigned to the unmatched time-slot whose
 * time-of-day is closest to the check-in's `timestamp` (the "deemed
 * time-slot time" — see docs/Intro.md § "Deemed time vs. recording time").
 * Check-ins are processed in chronological order; ties are broken by
 * the earlier time-slot. Back-filled check-ins — whose timestamp is set to
 * the time-slot's exact hour/minute — land on their intended time-slot even when
 * other check-ins are missing or were removed.
 *
 * A check-in with `skipped = true` marks its time-slot as "skipped" rather
 * than "done". Unmatched time-slots whose time has passed are "missed";
 * future time-slots are "upcoming". Check-ins with no time-slot to claim (more
 * check-ins than time-slots) are counted as `extras`.
 */
export const matchCheckInsToTimeSlots = ({
  schedules,
  checkIns,
  now,
}: MatchCheckInsToTimeSlotsInput): MatchCheckInsToTimeSlotsResult => {
  const todaysTimeSlots = schedules
    .filter(
      (s) =>
        s.hour !== null && s.hour !== undefined && appliesOnDay(s.days, now),
    )
    .map((s) => ({ hour: s.hour as number, minute: s.minute ?? 0 }))
    .sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute));

  const todaysCheckIns = checkIns
    .filter((c) => isSameCalendarDay(c.timestamp, now))
    .slice()
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  // Nearest-time assignment: for each check-in (in time order), claim
  // the unmatched time-slot whose time-of-day is closest. Iterating
  // `availableTime-slots` in insertion order (which is chronological, since
  // we sorted) means ties go to the earlier time-slot.
  const matchedByTimeSlot = new Map<
    number,
    { timestamp: Date; skipped?: boolean | null }
  >();
  const availableTimeSlots = new Set<number>(todaysTimeSlots.map((_, i) => i));
  for (const checkIn of todaysCheckIns) {
    if (availableTimeSlots.size === 0) break;
    const checkInMinutes =
      checkIn.timestamp.getHours() * 60 + checkIn.timestamp.getMinutes();
    let bestIdx = -1;
    let bestDist = Infinity;
    for (const i of availableTimeSlots) {
      const timeSlot = todaysTimeSlots[i];
      const dist = Math.abs(
        checkInMinutes - (timeSlot.hour * 60 + timeSlot.minute),
      );
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = i;
      }
    }
    matchedByTimeSlot.set(bestIdx, checkIn);
    availableTimeSlots.delete(bestIdx);
  }

  const timeSlots: TimeSlotState[] = todaysTimeSlots.map((timeSlot, i) => {
    const match = matchedByTimeSlot.get(i);
    if (match) {
      return {
        hour: timeSlot.hour,
        minute: timeSlot.minute,
        status: match.skipped ? "skipped" : "done",
        matchedAt: match.timestamp,
      };
    }
    const elapsed = timeSlot.hour * 60 + timeSlot.minute <= nowMinutes;
    return {
      hour: timeSlot.hour,
      minute: timeSlot.minute,
      status: elapsed ? "missed" : "upcoming",
    };
  });

  const extras = Math.max(0, todaysCheckIns.length - todaysTimeSlots.length);
  const done = timeSlots.filter((s) => s.status === "done").length;

  return { timeSlots, extras, done, total: todaysTimeSlots.length };
};
