import type { ScheduleInfo } from "./types";

export interface IsBackfillArgs {
  slot: { hour: number; minute: number };
  /** Calendar day the slot belongs to (as rendered on the habit detail tile). */
  day: Date;
  /** All schedules for the habit — used to look up the next slot on `day`. */
  schedules: ScheduleInfo[];
  /** Check-ins to consider. Only entries on the same calendar day as the slot are relevant. */
  checkIns: { timestamp: Date; skipped?: boolean | null }[];
  now: Date;
}

const NO_NEXT_SLOT_FALLBACK_MS = 30 * 60_000;

const startOfCalendarDay = (d: Date): Date => {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
};

const isSameCalendarDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const buildSlotTimestamp = (
  day: Date,
  slot: { hour: number; minute: number },
): Date =>
  new Date(
    day.getFullYear(),
    day.getMonth(),
    day.getDate(),
    slot.hour,
    slot.minute,
    0,
    0,
  );

const slotsForDay = (
  schedules: ScheduleInfo[],
  day: Date,
): { hour: number; minute: number }[] => {
  const dayBit = 1 << day.getDay();
  return schedules
    .filter((s) => {
      if (s.hour === null || s.hour === undefined) return false;
      const days = s.days ?? 0;
      return days === 0 || (days & dayBit) !== 0;
    })
    .map((s) => ({ hour: s.hour as number, minute: s.minute ?? 0 }))
    .sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute));
};

const findNextSlotAfter = (
  slot: { hour: number; minute: number },
  schedules: ScheduleInfo[],
  day: Date,
): { hour: number; minute: number } | null => {
  const slotMinutes = slot.hour * 60 + slot.minute;
  const next = slotsForDay(schedules, day).find(
    (s) => s.hour * 60 + s.minute > slotMinutes,
  );
  return next ?? null;
};

/** Rule: the slot is on a calendar day strictly before today. */
export const isPastDay = (day: Date, now: Date): boolean =>
  startOfCalendarDay(day).getTime() < startOfCalendarDay(now).getTime();

/** Rule: the slot's scheduled time is still in the future. */
export const isFutureSlot = (slotTs: Date, now: Date): boolean =>
  slotTs.getTime() > now.getTime();

/**
 * Rule: a check-in already exists on the same calendar day as the slot,
 * with a timestamp later than the slot's scheduled time — i.e. the user
 * is reaching back past something they've already logged.
 */
export const hasLaterCheckIn = (
  slotTs: Date,
  checkIns: { timestamp: Date }[],
): boolean =>
  checkIns.some(
    (c) =>
      isSameCalendarDay(c.timestamp, slotTs) &&
      c.timestamp.getTime() > slotTs.getTime(),
  );

/** Rule: the next scheduled slot on the same day has also already passed. */
export const nextSlotAlreadyPassed = (
  slot: { hour: number; minute: number },
  schedules: ScheduleInfo[],
  day: Date,
  now: Date,
): boolean => {
  const next = findNextSlotAfter(slot, schedules, day);
  if (!next) return false;
  return buildSlotTimestamp(day, next).getTime() <= now.getTime();
};

/**
 * Rule: more than half the gap between this slot and the next scheduled
 * slot has elapsed. Falls back to 30 minutes when there is no next slot
 * on the day.
 */
export const halfGapElapsed = (
  slot: { hour: number; minute: number },
  schedules: ScheduleInfo[],
  day: Date,
  now: Date,
): boolean => {
  const slotTs = buildSlotTimestamp(day, slot);
  const elapsed = now.getTime() - slotTs.getTime();
  if (elapsed <= 0) return false;
  const next = findNextSlotAfter(slot, schedules, day);
  const halfGap = next
    ? (buildSlotTimestamp(day, next).getTime() - slotTs.getTime()) / 2
    : NO_NEXT_SLOT_FALLBACK_MS;
  return elapsed > halfGap;
};

/**
 * True when long-pressing this slot should be framed as "back-filling"
 * historical data (vs. a normal "check in?"). Back-fill if ANY apply:
 *   1. slot is on a past calendar day
 *   2. a later check-in on the same day already exists
 *   3. the next scheduled slot on the day has also passed
 *   4. more than half the gap to the next slot has elapsed (30 min fallback)
 *
 * Future slots on today and slots that just passed with no newer
 * activity are NOT back-fills — they're ordinary check-ins.
 */
export const isBackfill = (args: IsBackfillArgs): boolean => {
  const slotTs = buildSlotTimestamp(args.day, args.slot);
  if (isPastDay(args.day, args.now)) return true;
  if (isFutureSlot(slotTs, args.now)) return false;
  if (hasLaterCheckIn(slotTs, args.checkIns)) return true;
  if (nextSlotAlreadyPassed(args.slot, args.schedules, args.day, args.now))
    return true;
  if (halfGapElapsed(args.slot, args.schedules, args.day, args.now))
    return true;
  return false;
};
