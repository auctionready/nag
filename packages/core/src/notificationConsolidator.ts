import type { AnyDb } from "./db";
import { allActiveSchedules } from "./queries";

export interface ConsolidatedNotificationScheduler {
  cancelAllSlotNotifications(): Promise<void>;
  scheduleSlotNotification(params: {
    identifier: string;
    title: string;
    body: string;
    data: Record<string, unknown>;
    trigger: {
      regularity: "day" | "week" | "month";
      hour: number;
      minute: number;
      dow?: number;
      dayOfMonth?: number;
    };
  }): Promise<void>;
}

export interface ConsolidatedSlot {
  key: string;
  habitIds: number[];
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
    habitId: number,
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

const slotContent = (
  slot: ConsolidatedSlot,
): { title: string; body: string } => {
  if (slot.habitIds.length === 1) {
    return { title: slot.titles[0], body: `Time for ${slot.titles[0]}` };
  }
  return {
    title: `${slot.habitIds.length} habits due`,
    body: slot.titles.join(", "),
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

export const syncAllNotifications = async (db: AnyDb): Promise<void> => {
  const rows = await allActiveSchedules(db);
  const slots = consolidateSchedules(rows);

  await scheduler.cancelAllSlotNotifications();

  for (const slot of slots) {
    const { title, body } = slotContent(slot);
    await scheduler.scheduleSlotNotification({
      identifier: `slot-${slot.key}`,
      title,
      body,
      data: { habitIds: slot.habitIds },
      trigger: {
        regularity: slot.regularity,
        hour: slot.hour,
        minute: slot.minute,
        dow: slot.dow,
        dayOfMonth: slot.dayOfMonth,
      },
    });
  }
};
