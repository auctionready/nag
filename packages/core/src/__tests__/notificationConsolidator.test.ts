import { describe, it, expect } from "vitest";
import { consolidateSchedules } from "../notificationConsolidator";
import { Day } from "../days";

const row = (
  overrides: Partial<{
    habitId: number;
    habitTitle: string;
    regularity: "day" | "week" | "month";
    scheduleId: number;
    hour: number;
    minute: number;
    days: number | null;
    dayOfMonth: number | null;
  }> = {},
) => ({
  habitId: 1,
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

  it("creates a single slot for one daily habit", () => {
    const slots = consolidateSchedules([row()]);
    expect(slots).toHaveLength(1);
    expect(slots[0]).toMatchObject({
      key: "daily-08-00",
      habitIds: [1],
      titles: ["Exercise"],
      regularity: "day",
      hour: 8,
      minute: 0,
    });
  });

  it("consolidates two daily habits at the same time", () => {
    const slots = consolidateSchedules([
      row({ habitId: 1, habitTitle: "Exercise" }),
      row({ habitId: 2, habitTitle: "Meditate", scheduleId: 20 }),
    ]);
    expect(slots).toHaveLength(1);
    expect(slots[0].habitIds).toEqual([1, 2]);
    expect(slots[0].titles).toEqual(["Exercise", "Meditate"]);
  });

  it("does not consolidate daily habits at different times", () => {
    const slots = consolidateSchedules([
      row({ habitId: 1, hour: 8, minute: 0 }),
      row({ habitId: 2, hour: 9, minute: 0, scheduleId: 20 }),
    ]);
    expect(slots).toHaveLength(2);
  });

  it("does not consolidate habits with different regularity at the same time", () => {
    const slots = consolidateSchedules([
      row({ habitId: 1, regularity: "day" }),
      row({
        habitId: 2,
        regularity: "week",
        days: Day.Mon,
        scheduleId: 20,
      }),
    ]);
    expect(slots).toHaveLength(2);
  });

  it("expands weekly bitmask into separate slots per day", () => {
    const slots = consolidateSchedules([
      row({
        regularity: "week",
        days: Day.Mon | Day.Wed,
      }),
    ]);
    expect(slots).toHaveLength(2);
    expect(slots.map((s) => s.key).sort()).toEqual([
      "weekly-1-08-00",
      "weekly-3-08-00",
    ]);
  });

  it("consolidates two weekly habits on the same day and time", () => {
    const slots = consolidateSchedules([
      row({
        habitId: 1,
        habitTitle: "Run",
        regularity: "week",
        days: Day.Mon,
      }),
      row({
        habitId: 2,
        habitTitle: "Stretch",
        regularity: "week",
        days: Day.Mon,
        scheduleId: 20,
      }),
    ]);
    expect(slots).toHaveLength(1);
    expect(slots[0].habitIds).toEqual([1, 2]);
    expect(slots[0].dow).toBe(1);
  });

  it("creates separate slots for monthly habits on different days", () => {
    const slots = consolidateSchedules([
      row({ habitId: 1, regularity: "month", dayOfMonth: 1 }),
      row({ habitId: 2, regularity: "month", dayOfMonth: 15, scheduleId: 20 }),
    ]);
    expect(slots).toHaveLength(2);
  });

  it("consolidates monthly habits on the same day and time", () => {
    const slots = consolidateSchedules([
      row({
        habitId: 1,
        habitTitle: "Review",
        regularity: "month",
        dayOfMonth: 1,
      }),
      row({
        habitId: 2,
        habitTitle: "Plan",
        regularity: "month",
        dayOfMonth: 1,
        scheduleId: 20,
      }),
    ]);
    expect(slots).toHaveLength(1);
    expect(slots[0].habitIds).toEqual([1, 2]);
    expect(slots[0].dayOfMonth).toBe(1);
  });

  it("deduplicates same habit appearing twice in the same slot", () => {
    const slots = consolidateSchedules([
      row({ habitId: 1, scheduleId: 10 }),
      row({ habitId: 1, scheduleId: 11 }),
    ]);
    expect(slots).toHaveLength(1);
    expect(slots[0].habitIds).toEqual([1]);
  });
});
