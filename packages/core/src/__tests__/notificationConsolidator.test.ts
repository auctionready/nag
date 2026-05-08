import { describe, it, expect } from "vitest";
import {
  consolidateSchedules,
  nextOccurrences,
  timeSlotContent,
  type ConsolidatedTimeSlot,
} from "../notificationConsolidator";
import { Day } from "../days";

const row = (
  overrides: Partial<{
    habitId: string;
    habitTitle: string;
    regularity: "day" | "week" | "month";
    scheduleId: number;
    hour: number;
    minute: number;
    days: number | null;
    dayOfMonth: number | null;
  }> = {},
) => ({
  habitId: "h-1",
  habitTitle: "Exercise",
  regularity: "day" as const,
  scheduleId: 10,
  hour: 8,
  minute: 0,
  days: null,
  dayOfMonth: null,
  ...overrides,
});

describe("consolidateSchedules", () => {
  it("returns empty array for no rows", () => {
    expect(consolidateSchedules([])).toEqual([]);
  });

  it("creates a single timeSlot for one daily habit", () => {
    const timeSlots = consolidateSchedules([row()]);
    expect(timeSlots).toHaveLength(1);
    expect(timeSlots[0]).toMatchObject({
      key: "daily-08-00",
      habitIds: ["h-1"],
      titles: ["Exercise"],
      regularity: "day",
      hour: 8,
      minute: 0,
    });
  });

  it("consolidates two daily habits at the same time", () => {
    const timeSlots = consolidateSchedules([
      row({ habitId: "h-1", habitTitle: "Exercise" }),
      row({ habitId: "h-2", habitTitle: "Meditate", scheduleId: 20 }),
    ]);
    expect(timeSlots).toHaveLength(1);
    expect(timeSlots[0].habitIds).toEqual(["h-1", "h-2"]);
    expect(timeSlots[0].titles).toEqual(["Exercise", "Meditate"]);
  });

  it("does not consolidate daily habits at different times", () => {
    const timeSlots = consolidateSchedules([
      row({ habitId: "h-1", hour: 8, minute: 0 }),
      row({ habitId: "h-2", hour: 9, minute: 0, scheduleId: 20 }),
    ]);
    expect(timeSlots).toHaveLength(2);
  });

  it("does not consolidate habits with different regularity at the same time", () => {
    const timeSlots = consolidateSchedules([
      row({ habitId: "h-1", regularity: "day" }),
      row({
        habitId: "h-2",
        regularity: "week",
        days: Day.Mon,
        scheduleId: 20,
      }),
    ]);
    expect(timeSlots).toHaveLength(2);
  });

  it("expands weekly bitmask into separate timeSlots per day", () => {
    const timeSlots = consolidateSchedules([
      row({
        regularity: "week",
        days: Day.Mon | Day.Wed,
      }),
    ]);
    expect(timeSlots).toHaveLength(2);
    expect(timeSlots.map((s) => s.key).sort()).toEqual([
      "weekly-1-08-00",
      "weekly-3-08-00",
    ]);
  });

  it("consolidates two weekly habits on the same day and time", () => {
    const timeSlots = consolidateSchedules([
      row({
        habitId: "h-1",
        habitTitle: "Run",
        regularity: "week",
        days: Day.Mon,
      }),
      row({
        habitId: "h-2",
        habitTitle: "Stretch",
        regularity: "week",
        days: Day.Mon,
        scheduleId: 20,
      }),
    ]);
    expect(timeSlots).toHaveLength(1);
    expect(timeSlots[0].habitIds).toEqual(["h-1", "h-2"]);
    expect(timeSlots[0].dow).toBe(1);
  });

  it("creates separate timeSlots for monthly habits on different days", () => {
    const timeSlots = consolidateSchedules([
      row({ habitId: "h-1", regularity: "month", dayOfMonth: 1 }),
      row({
        habitId: "h-2",
        regularity: "month",
        dayOfMonth: 15,
        scheduleId: 20,
      }),
    ]);
    expect(timeSlots).toHaveLength(2);
  });

  it("consolidates monthly habits on the same day and time", () => {
    const timeSlots = consolidateSchedules([
      row({
        habitId: "h-1",
        habitTitle: "Review",
        regularity: "month",
        dayOfMonth: 1,
      }),
      row({
        habitId: "h-2",
        habitTitle: "Plan",
        regularity: "month",
        dayOfMonth: 1,
        scheduleId: 20,
      }),
    ]);
    expect(timeSlots).toHaveLength(1);
    expect(timeSlots[0].habitIds).toEqual(["h-1", "h-2"]);
    expect(timeSlots[0].dayOfMonth).toBe(1);
  });

  it("deduplicates same habit appearing twice in the same timeSlot", () => {
    const timeSlots = consolidateSchedules([
      row({ habitId: "h-1", scheduleId: 10 }),
      row({ habitId: "h-1", scheduleId: 11 }),
    ]);
    expect(timeSlots).toHaveLength(1);
    expect(timeSlots[0].habitIds).toEqual(["h-1"]);
  });
});

const daily = (
  overrides: Partial<ConsolidatedTimeSlot> = {},
): ConsolidatedTimeSlot => ({
  key: "daily-08-00",
  habitIds: ["h-1"],
  titles: ["Exercise"],
  regularity: "day",
  hour: 8,
  minute: 0,
  ...overrides,
});

describe("nextOccurrences", () => {
  describe("daily", () => {
    it("includes today when the timeSlot is still in the future", () => {
      const now = new Date(2026, 3, 15, 6, 0);
      const out = nextOccurrences(daily(), now);
      expect(out).toHaveLength(7);
      expect(out[0]).toEqual(new Date(2026, 3, 15, 8, 0));
      expect(out[6]).toEqual(new Date(2026, 3, 21, 8, 0));
    });

    it("skips today when the timeSlot has already passed", () => {
      const now = new Date(2026, 3, 15, 10, 0);
      const out = nextOccurrences(daily(), now);
      expect(out).toHaveLength(7);
      expect(out[0]).toEqual(new Date(2026, 3, 16, 8, 0));
      expect(out[6]).toEqual(new Date(2026, 3, 22, 8, 0));
    });
  });

  describe("weekly", () => {
    it("returns the next 4 occurrences of the target weekday", () => {
      // 2026-04-15 is a Wednesday (dow=3). Target: Monday (dow=1).
      const now = new Date(2026, 3, 15, 10, 0);
      const timeSlot: ConsolidatedTimeSlot = {
        key: "weekly-1-08-00",
        habitIds: ["h-1"],
        titles: ["Run"],
        regularity: "week",
        hour: 8,
        minute: 0,
        dow: 1,
      };
      const out = nextOccurrences(timeSlot, now);
      expect(out).toHaveLength(4);
      expect(out[0].getDay()).toBe(1);
      // Next Monday is 2026-04-20.
      expect(out[0]).toEqual(new Date(2026, 3, 20, 8, 0));
      expect(out[3]).toEqual(new Date(2026, 4, 11, 8, 0));
    });

    it("includes today when the target weekday is today and timeSlot is future", () => {
      // Wed 2026-04-15, target dow=3 (Wednesday), 8:00 is still future from 06:00.
      const now = new Date(2026, 3, 15, 6, 0);
      const timeSlot: ConsolidatedTimeSlot = {
        key: "weekly-3-08-00",
        habitIds: ["h-1"],
        titles: ["Run"],
        regularity: "week",
        hour: 8,
        minute: 0,
        dow: 3,
      };
      const out = nextOccurrences(timeSlot, now);
      expect(out[0]).toEqual(new Date(2026, 3, 15, 8, 0));
    });
  });

  describe("monthly", () => {
    it("skips months whose dayOfMonth does not exist (Jan 31 -> Feb skipped)", () => {
      const now = new Date(2026, 0, 31, 9, 0);
      const timeSlot: ConsolidatedTimeSlot = {
        key: "monthly-31-08-00",
        habitIds: ["h-1"],
        titles: ["Review"],
        regularity: "month",
        hour: 8,
        minute: 0,
        dayOfMonth: 31,
      };
      const out = nextOccurrences(timeSlot, now);
      expect(out).toHaveLength(3);
      // Jan 31 at 08:00 is already past (now=09:00). Next valid: Mar 31, May 31, Jul 31.
      expect(out[0]).toEqual(new Date(2026, 2, 31, 8, 0));
      expect(out[1]).toEqual(new Date(2026, 4, 31, 8, 0));
      expect(out[2]).toEqual(new Date(2026, 6, 31, 8, 0));
    });
  });
});

describe("timeSlotContent", () => {
  it("formats a single-habit timeSlot", () => {
    const timeSlot = daily({ titles: ["Read"] });
    expect(timeSlotContent(timeSlot)).toEqual({
      title: "Read",
      body: "Time for Read",
    });
  });

  it("formats a multi-habit timeSlot", () => {
    const timeSlot = daily({
      habitIds: ["h-1", "h-2"],
      titles: ["Read", "Stretch"],
    });
    expect(timeSlotContent(timeSlot)).toEqual({
      title: "2 habits due",
      body: "Read, Stretch",
    });
  });

  it("trims to included titles", () => {
    const timeSlot = daily({
      habitIds: ["h-1", "h-2"],
      titles: ["Read", "Stretch"],
    });
    expect(timeSlotContent(timeSlot, ["Stretch"])).toEqual({
      title: "Stretch",
      body: "Time for Stretch",
    });
  });
});
