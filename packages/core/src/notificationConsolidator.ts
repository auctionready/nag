import type { AnyDb } from "./db";
import { allActiveSchedules, checkInsForHabitsOnDay } from "./queries";
import { matchCheckInsToSlots } from "./trafficLight";

export interface ConsolidatedNotificationScheduler {
  cancelAllSlotNotifications(): Promise<void>;
  scheduleSlotNotification(params: {
    identifier: string;
    title: string;
    body: string;
    data: Record<string, unknown>;
    fireAt: Date;
  }): Promise<void>;
}

export interface ConsolidatedSlot {
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

const slotKey = (
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
): ConsolidatedSlot[] => {
  const slots = new Map<string, ConsolidatedSlot>();

  const addToSlot = (
    key: string,
    habitId: string,
    title: string,
    regularity: "day" | "week" | "month",
    hour: number,
    minute: number,
    dow?: number,
    dayOfMonth?: number,
  ) => {
    const existing = slots.get(key);
    if (existing) {
      if (!existing.habitIds.includes(habitId)) {
        existing.habitIds.push(habitId);
        existing.titles.push(title);
      }
    } else {
      slots.set(key, {
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
      const key = slotKey("daily", row.hour, row.minute);
      addToSlot(key, row.habitId, row.habitTitle, "day", row.hour, row.minute);
    } else if (row.regularity === "week") {
      const days = row.days ?? 0;
      for (let dow = 0; dow < 7; dow++) {
        if (days & (1 << dow)) {
          const key = slotKey("weekly", row.hour, row.minute, dow);
          addToSlot(
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
      const key = slotKey("monthly", row.hour, row.minute, row.dayOfMonth!);
      addToSlot(
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

  return Array.from(slots.values());
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
 * Compute the next N concrete occurrence `Date`s for a slot, strictly
 * after `now`. Uses local calendar arithmetic (NOT `+= 86_400_000`) so
 * DST transitions keep the notification at the intended wall-clock time.
 * Monthly occurrences skip months whose `dayOfMonth` doesn't exist
 * (e.g. a Jan-31 slot skips February).
 */
export const nextOccurrences = (slot: ConsolidatedSlot, now: Date): Date[] => {
  const out: Date[] = [];
  if (slot.regularity === "day") {
    for (
      let i = 0;
      out.length < DAILY_HORIZON_DAYS && i < DAILY_HORIZON_DAYS + 2;
      i++
    ) {
      const d = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + i,
        slot.hour,
        slot.minute,
        0,
        0,
      );
      if (d > now) out.push(d);
    }
  } else if (slot.regularity === "week") {
    const todayDow = now.getDay();
    const offsetToFirst = (slot.dow! - todayDow + 7) % 7;
    for (
      let w = 0;
      out.length < WEEKLY_HORIZON_WEEKS && w < WEEKLY_HORIZON_WEEKS + 2;
      w++
    ) {
      const d = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + offsetToFirst + 7 * w,
        slot.hour,
        slot.minute,
        0,
        0,
      );
      if (d > now) out.push(d);
    }
  } else {
    const dom = slot.dayOfMonth!;
    for (
      let i = 0;
      out.length < MONTHLY_HORIZON_MONTHS && i < MONTHLY_HORIZON_MONTHS + 6;
      i++
    ) {
      const y = now.getFullYear();
      const m = now.getMonth() + i;
      const lastDayOfMonth = new Date(y, m + 1, 0).getDate();
      if (dom > lastDayOfMonth) continue;
      const d = new Date(y, m, dom, slot.hour, slot.minute, 0, 0);
      if (d > now) out.push(d);
    }
  }
  return out;
};

const ymd = (d: Date) =>
  `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;

const occurrenceIdentifier = (slot: ConsolidatedSlot, fireAt: Date): string =>
  `slot-${slot.key}-${ymd(fireAt)}-${pad(fireAt.getHours())}${pad(fireAt.getMinutes())}`;

interface SlotContent {
  title: string;
  body: string;
}

/**
 * Title/body for a slot, optionally restricted to a subset of habits
 * (the ones NOT already checked in for this occurrence). The `data`
 * payload separately always carries every habit in the slot so opening
 * the reminder still shows the full list with status badges.
 */
export const slotContent = (
  slot: ConsolidatedSlot,
  includedTitles: string[] = slot.titles,
): SlotContent => {
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
  cancelAllSlotNotifications: async () => {},
  scheduleSlotNotification: async () => {},
};

let scheduler: ConsolidatedNotificationScheduler = noop;

export const setConsolidatedScheduler = (
  s: ConsolidatedNotificationScheduler,
) => {
  scheduler = s;
};

export const getConsolidatedScheduler = () => scheduler;

/**
 * For a specific slot at a specific occurrence date, decide which
 * habits are already satisfied (have a check-in or skip matching this
 * slot on that date). Returns the indexes of the habits that are still
 * pending and therefore should still be nagged.
 */
const pendingHabitIndexes = (
  slot: ConsolidatedSlot,
  occurrence: Date,
  checkInsByHabit: Map<string, { timestamp: Date; skipped: boolean | null }[]>,
  schedulesByHabit: Map<string, ScheduleRow[]>,
): number[] => {
  const pending: number[] = [];
  for (let i = 0; i < slot.habitIds.length; i++) {
    const habitId = slot.habitIds[i];
    const habitSchedules = schedulesByHabit.get(habitId) ?? [];
    const habitCheckIns = checkInsByHabit.get(habitId) ?? [];
    const { slots } = matchCheckInsToSlots({
      schedules: habitSchedules,
      checkIns: habitCheckIns,
      now: occurrence,
    });
    const match = slots.find(
      (s) => s.hour === slot.hour && s.minute === slot.minute,
    );
    const satisfied = match?.status === "done" || match?.status === "skipped";
    if (!satisfied) pending.push(i);
  }
  return pending;
};

/**
 * Cancel all existing `slot-*` notifications and re-emit one-shot
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
  const slots = consolidateSchedules(rows);

  await scheduler.cancelAllSlotNotifications();

  if (slots.length === 0) return;

  // Widest possible lookup window across all slots: up to ~3 months out.
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
  const allHabitIds = Array.from(new Set(slots.flatMap((s) => s.habitIds)));
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

  // Group the raw schedule rows by habit for per-habit slot matching.
  const schedulesByHabit = new Map<string, ScheduleRow[]>();
  for (const row of rows) {
    const list = schedulesByHabit.get(row.habitId) ?? [];
    list.push(row);
    schedulesByHabit.set(row.habitId, list);
  }

  interface PendingSchedule {
    slot: ConsolidatedSlot;
    fireAt: Date;
    pendingIdxs: number[];
  }

  const candidates: PendingSchedule[] = [];
  for (const slot of slots) {
    for (const fireAt of nextOccurrences(slot, now)) {
      const pendingIdxs = pendingHabitIndexes(
        slot,
        fireAt,
        checkInsByHabit,
        schedulesByHabit,
      );
      if (pendingIdxs.length === 0) continue;
      candidates.push({ slot, fireAt, pendingIdxs });
    }
  }

  candidates.sort((a, b) => a.fireAt.getTime() - b.fireAt.getTime());
  const picked = candidates.slice(0, TOTAL_OCCURRENCE_CAP);

  await Promise.all(
    picked.map(({ slot, fireAt, pendingIdxs }) => {
      const pendingTitles = pendingIdxs.map((i) => slot.titles[i]);
      const { title, body } = slotContent(slot, pendingTitles);
      return scheduler.scheduleSlotNotification({
        identifier: occurrenceIdentifier(slot, fireAt),
        title,
        body,
        data: {
          habitIds: slot.habitIds,
          slotHour: slot.hour,
          slotMinute: slot.minute,
        },
        fireAt,
      });
    }),
  );
};
