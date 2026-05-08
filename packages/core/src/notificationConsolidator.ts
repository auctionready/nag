import type { AnyDb } from "./db";
import { allActiveSchedules, checkInsForHabitsOnDay } from "./queries";
import { matchCheckInsToTimeSlots } from "./trafficLight";

export interface ConsolidatedNotificationScheduler {
  cancelAllTimeSlotNotifications(): Promise<void>;
  scheduleTimeSlotNotification(params: {
    identifier: string;
    title: string;
    body: string;
    data: Record<string, unknown>;
    fireAt: Date;
  }): Promise<void>;
}

export interface ConsolidatedTimeSlot {
  key: string;
  habitIds: string[];
  titles: string[];
  regularity: "day" | "week" | "month";
  hour: number;
  minute: number;
  dow?: number;
  dayOfMonth?: number;
}

type ScheduleRow = Awaited<ReturnType<typeof allActiveSchedules>>[number];

const pad = (n: number) => String(n).padStart(2, "0");

const timeSlotKey = (
  regularity: string,
  hour: number,
  minute: number,
  extra?: number,
): string => {
  const time = `${pad(hour)}-${pad(minute)}`;
  return extra !== undefined
    ? `${regularity}-${extra}-${time}`
    : `${regularity}-${time}`;
};

export const consolidateSchedules = (
  rows: ScheduleRow[],
): ConsolidatedTimeSlot[] => {
  const timeSlots = new Map<string, ConsolidatedTimeSlot>();

  const addToTimeSlot = (
    key: string,
    habitId: string,
    title: string,
    regularity: "day" | "week" | "month",
    hour: number,
    minute: number,
    dow?: number,
    dayOfMonth?: number,
  ) => {
    const existing = timeSlots.get(key);
    if (existing) {
      if (!existing.habitIds.includes(habitId)) {
        existing.habitIds.push(habitId);
        existing.titles.push(title);
      }
    } else {
      timeSlots.set(key, {
        key,
        habitIds: [habitId],
        titles: [title],
        regularity,
        hour,
        minute,
        dow,
        dayOfMonth,
      });
    }
  };

  for (const row of rows) {
    if (row.regularity === "day") {
      const key = timeSlotKey("daily", row.hour, row.minute);
      addToTimeSlot(
        key,
        row.habitId,
        row.habitTitle,
        "day",
        row.hour,
        row.minute,
      );
    } else if (row.regularity === "week") {
      const days = row.days ?? 0;
      for (let dow = 0; dow < 7; dow++) {
        if (days & (1 << dow)) {
          const key = timeSlotKey("weekly", row.hour, row.minute, dow);
          addToTimeSlot(
            key,
            row.habitId,
            row.habitTitle,
            "week",
            row.hour,
            row.minute,
            dow,
          );
        }
      }
    } else {
      const key = timeSlotKey("monthly", row.hour, row.minute, row.dayOfMonth!);
      addToTimeSlot(
        key,
        row.habitId,
        row.habitTitle,
        "month",
        row.hour,
        row.minute,
        undefined,
        row.dayOfMonth!,
      );
    }
  }

  return Array.from(timeSlots.values());
};

/**
 * How far ahead to pre-schedule one-shot notifications. iOS caps pending
 * local notifications at 64, so keep the totals conservative.
 */
export const DAILY_HORIZON_DAYS = 7;
export const WEEKLY_HORIZON_WEEKS = 4;
export const MONTHLY_HORIZON_MONTHS = 3;
const TOTAL_OCCURRENCE_CAP = 60;

/**
 * Compute the next N concrete occurrence `Date`s for a time-slot, strictly
 * after `now`. Uses local calendar arithmetic (NOT `+= 86_400_000`) so
 * DST transitions keep the notification at the intended wall-clock time.
 * Monthly occurrences skip months whose `dayOfMonth` doesn't exist
 * (e.g. a Jan-31 time-slot skips February).
 */
export const nextOccurrences = (
  timeSlot: ConsolidatedTimeSlot,
  now: Date,
): Date[] => {
  const out: Date[] = [];
  if (timeSlot.regularity === "day") {
    for (
      let i = 0;
      out.length < DAILY_HORIZON_DAYS && i < DAILY_HORIZON_DAYS + 2;
      i++
    ) {
      const d = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + i,
        timeSlot.hour,
        timeSlot.minute,
        0,
        0,
      );
      if (d > now) out.push(d);
    }
  } else if (timeSlot.regularity === "week") {
    const todayDow = now.getDay();
    const offsetToFirst = (timeSlot.dow! - todayDow + 7) % 7;
    for (
      let w = 0;
      out.length < WEEKLY_HORIZON_WEEKS && w < WEEKLY_HORIZON_WEEKS + 2;
      w++
    ) {
      const d = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + offsetToFirst + 7 * w,
        timeSlot.hour,
        timeSlot.minute,
        0,
        0,
      );
      if (d > now) out.push(d);
    }
  } else {
    const dom = timeSlot.dayOfMonth!;
    for (
      let i = 0;
      out.length < MONTHLY_HORIZON_MONTHS && i < MONTHLY_HORIZON_MONTHS + 6;
      i++
    ) {
      const y = now.getFullYear();
      const m = now.getMonth() + i;
      const lastDayOfMonth = new Date(y, m + 1, 0).getDate();
      if (dom > lastDayOfMonth) continue;
      const d = new Date(y, m, dom, timeSlot.hour, timeSlot.minute, 0, 0);
      if (d > now) out.push(d);
    }
  }
  return out;
};

const ymd = (d: Date) =>
  `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;

const occurrenceIdentifier = (
  timeSlot: ConsolidatedTimeSlot,
  fireAt: Date,
): string =>
  `timeSlot-${timeSlot.key}-${ymd(fireAt)}-${pad(fireAt.getHours())}${pad(fireAt.getMinutes())}`;

interface TimeSlotContent {
  title: string;
  body: string;
}

/**
 * Title/body for a time-slot, optionally restricted to a subset of habits
 * (the ones NOT already checked in for this occurrence). The `data`
 * payload separately always carries every habit in the time-slot so opening
 * the reminder still shows the full list with status badges.
 */
export const timeSlotContent = (
  timeSlot: ConsolidatedTimeSlot,
  includedTitles: string[] = timeSlot.titles,
): TimeSlotContent => {
  if (includedTitles.length === 1) {
    return {
      title: includedTitles[0],
      body: `Time for ${includedTitles[0]}`,
    };
  }
  return {
    title: `${includedTitles.length} habits due`,
    body: includedTitles.join(", "),
  };
};

const noop: ConsolidatedNotificationScheduler = {
  cancelAllTimeSlotNotifications: async () => {},
  scheduleTimeSlotNotification: async () => {},
};

let scheduler: ConsolidatedNotificationScheduler = noop;

export const setConsolidatedScheduler = (
  s: ConsolidatedNotificationScheduler,
) => {
  scheduler = s;
};

export const getConsolidatedScheduler = () => scheduler;

/**
 * For a specific time-slot at a specific occurrence date, decide which
 * habits are already satisfied (have a check-in or skip matching this
 * time-slot on that date). Returns the indexes of the habits that are still
 * pending and therefore should still be nagged.
 */
const pendingHabitIndexes = (
  timeSlot: ConsolidatedTimeSlot,
  occurrence: Date,
  checkInsByHabit: Map<string, { timestamp: Date; skipped: boolean | null }[]>,
  schedulesByHabit: Map<string, ScheduleRow[]>,
): number[] => {
  const pending: number[] = [];
  for (let i = 0; i < timeSlot.habitIds.length; i++) {
    const habitId = timeSlot.habitIds[i];
    const habitSchedules = schedulesByHabit.get(habitId) ?? [];
    const habitCheckIns = checkInsByHabit.get(habitId) ?? [];
    const { timeSlots } = matchCheckInsToTimeSlots({
      schedules: habitSchedules,
      checkIns: habitCheckIns,
      now: occurrence,
    });
    const match = timeSlots.find(
      (s) => s.hour === timeSlot.hour && s.minute === timeSlot.minute,
    );
    const satisfied = match?.status === "done" || match?.status === "skipped";
    if (!satisfied) pending.push(i);
  }
  return pending;
};

/**
 * Cancel all existing `time-slot-*` notifications and re-emit one-shot
 * notifications for the next rolling window of concrete occurrences,
 * skipping any occurrence whose habits are already fully satisfied and
 * trimming the title/body of partially satisfied occurrences.
 */
export const syncAllNotifications = async (
  db: AnyDb,
  opts: { now?: Date } = {},
): Promise<void> => {
  const now = opts.now ?? new Date();
  const rows = await allActiveSchedules(db);
  const timeSlots = consolidateSchedules(rows);

  await scheduler.cancelAllTimeSlotNotifications();

  if (timeSlots.length === 0) return;

  // Widest possible lookup window across all time-slots: up to ~3 months out.
  const lookupStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );
  const lookupEnd = new Date(
    now.getFullYear(),
    now.getMonth() + MONTHLY_HORIZON_MONTHS + 1,
    1,
  );
  const allHabitIds = Array.from(new Set(timeSlots.flatMap((s) => s.habitIds)));
  const checkInRows = await checkInsForHabitsOnDay(
    db,
    allHabitIds,
    lookupStart,
    lookupEnd,
  );
  const checkInsByHabit = new Map<
    string,
    { timestamp: Date; skipped: boolean | null }[]
  >();
  for (const c of checkInRows) {
    const list = checkInsByHabit.get(c.habitId) ?? [];
    list.push({ timestamp: c.timestamp, skipped: c.skipped });
    checkInsByHabit.set(c.habitId, list);
  }

  // Group the raw schedule rows by habit for per-habit time-slot matching.
  const schedulesByHabit = new Map<string, ScheduleRow[]>();
  for (const row of rows) {
    const list = schedulesByHabit.get(row.habitId) ?? [];
    list.push(row);
    schedulesByHabit.set(row.habitId, list);
  }

  interface PendingSchedule {
    timeSlot: ConsolidatedTimeSlot;
    fireAt: Date;
    pendingIdxs: number[];
  }

  const candidates: PendingSchedule[] = [];
  for (const timeSlot of timeSlots) {
    for (const fireAt of nextOccurrences(timeSlot, now)) {
      const pendingIdxs = pendingHabitIndexes(
        timeSlot,
        fireAt,
        checkInsByHabit,
        schedulesByHabit,
      );
      if (pendingIdxs.length === 0) continue;
      candidates.push({ timeSlot, fireAt, pendingIdxs });
    }
  }

  candidates.sort((a, b) => a.fireAt.getTime() - b.fireAt.getTime());
  const picked = candidates.slice(0, TOTAL_OCCURRENCE_CAP);

  await Promise.all(
    picked.map(({ timeSlot, fireAt, pendingIdxs }) => {
      const pendingTitles = pendingIdxs.map((i) => timeSlot.titles[i]);
      const { title, body } = timeSlotContent(timeSlot, pendingTitles);
      return scheduler.scheduleTimeSlotNotification({
        identifier: occurrenceIdentifier(timeSlot, fireAt),
        title,
        body,
        data: {
          habitIds: timeSlot.habitIds,
          timeSlotHour: timeSlot.hour,
          timeSlotMinute: timeSlot.minute,
        },
        fireAt,
      });
    }),
  );
};
