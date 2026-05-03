import type { Regularity } from "@nag/schema";
import type { ScheduleInfo } from "@nag/core";
import type { SlotDotState } from "../slotDotState";
import { computeChipState } from "../TileProgressChip";

const goal = (regularity: Regularity, frequency: number) => ({
  regularity,
  frequency,
  title: "habit",
  createdAt: new Date(),
});

const everyDayAt = (hour: number, minute: number): ScheduleInfo => ({
  days: 0x7f,
  dayOfMonth: null,
  hour,
  minute,
});

const someDaysAt = (
  days: number,
  hour: number,
  minute: number,
): ScheduleInfo => ({
  days,
  dayOfMonth: null,
  hour,
  minute,
});

const inputs = (overrides: {
  goal: ReturnType<typeof goal> | null;
  todaySlots?: SlotDotState[];
  periodCheckInCount?: number;
  multiSlotPerDay?: boolean;
  schedules?: ScheduleInfo[];
  /** Convenience: equivalent to `schedules: [someDaysAt(0b0101010, 9, 0)]`. */
  hasSchedules?: boolean;
}) => {
  const { hasSchedules, schedules, ...rest } = overrides;
  return {
    todaySlots: undefined,
    periodCheckInCount: 0,
    multiSlotPerDay: false,
    schedules: schedules ?? (hasSchedules ? [someDaysAt(0b0101010, 9, 0)] : []),
    ...rest,
  };
};

describe("computeChipState", () => {
  describe("returns null", () => {
    it("when goal is null", () => {
      expect(computeChipState(inputs({ goal: null }))).toBeNull();
    });
  });

  describe("frequency = 1 → text label", () => {
    it("renders 'daily' for daily/freq=1", () => {
      expect(computeChipState(inputs({ goal: goal("day", 1) }))).toEqual({
        kind: "label",
        text: "daily",
      });
    });

    it("renders 'weekly' for weekly/freq=1", () => {
      expect(computeChipState(inputs({ goal: goal("week", 1) }))).toEqual({
        kind: "label",
        text: "weekly",
      });
    });

    it("renders 'monthly' for monthly/freq=1", () => {
      expect(computeChipState(inputs({ goal: goal("month", 1) }))).toEqual({
        kind: "label",
        text: "monthly",
      });
    });
  });

  describe("daily, frequency > 1", () => {
    it("uses provided todaySlots with today eyebrow", () => {
      const slots: SlotDotState[] = ["done", "pending", "pending"];
      expect(
        computeChipState(inputs({ goal: goal("day", 3), todaySlots: slots })),
      ).toEqual({ kind: "dots", slots, prefixToday: true });
    });

    it("falls back to all-pending pips when todaySlots is missing", () => {
      expect(computeChipState(inputs({ goal: goal("day", 3) }))).toEqual({
        kind: "dots",
        slots: ["pending", "pending", "pending"],
        prefixToday: true,
      });
    });
  });

  describe("weekly, frequency > 1, multi-slot-per-day", () => {
    it("uses todaySlots with today eyebrow", () => {
      const slots: SlotDotState[] = ["done", "pending", "pending"];
      expect(
        computeChipState(
          inputs({
            goal: goal("week", 9),
            todaySlots: slots,
            multiSlotPerDay: true,
            hasSchedules: true,
          }),
        ),
      ).toEqual({ kind: "dots", slots, prefixToday: true });
    });

    it("shows 'off today' label when today has no slots", () => {
      expect(
        computeChipState(
          inputs({
            goal: goal("week", 9),
            multiSlotPerDay: true,
            hasSchedules: true,
          }),
        ),
      ).toEqual({ kind: "label", text: "off today" });
    });
  });

  describe("weekly, frequency > 1, scheduled (single-slot-per-day)", () => {
    it("renders text label like '3× / wk' — week-strip carries the day detail", () => {
      // Schedule has specific days (e.g. M·W·F) at one slot each. Dots
      // would be redundant with the week-strip below.
      expect(
        computeChipState(inputs({ goal: goal("week", 3), hasSchedules: true })),
      ).toEqual({ kind: "label", text: "3× / wk" });
    });
  });

  describe("weekly, frequency > 1, unscheduled", () => {
    it("renders N=frequency dots filled from week count", () => {
      expect(
        computeChipState(
          inputs({ goal: goal("week", 3), periodCheckInCount: 2 }),
        ),
      ).toEqual({
        kind: "dots",
        slots: ["done", "done", "pending"],
        prefixToday: false,
      });
    });

    it("emits all-pending when no check-ins this week yet", () => {
      expect(computeChipState(inputs({ goal: goal("week", 4) }))).toEqual({
        kind: "dots",
        slots: ["pending", "pending", "pending", "pending"],
        prefixToday: false,
      });
    });

    it("emits all-done when count equals frequency", () => {
      expect(
        computeChipState(
          inputs({ goal: goal("week", 3), periodCheckInCount: 3 }),
        ),
      ).toEqual({
        kind: "dots",
        slots: ["done", "done", "done"],
        prefixToday: false,
      });
    });

    it("appends ahead pips when count exceeds frequency", () => {
      expect(
        computeChipState(
          inputs({ goal: goal("week", 2), periodCheckInCount: 4 }),
        ),
      ).toEqual({
        kind: "dots",
        slots: ["done", "done", "ahead", "ahead"],
        prefixToday: false,
      });
    });
  });

  describe("single schedule every day at fixed time", () => {
    it("replaces 'Nx / wk' with '<time> daily' for weekly habits", () => {
      expect(
        computeChipState(
          inputs({
            goal: goal("week", 7),
            schedules: [everyDayAt(19, 30)],
          }),
        ),
      ).toEqual({ kind: "label", text: "7:30 PM daily" });
    });

    it("replaces 'daily' with '<time> daily' for daily/freq=1 habits", () => {
      expect(
        computeChipState(
          inputs({
            goal: goal("day", 1),
            schedules: [everyDayAt(7, 0)],
          }),
        ),
      ).toEqual({ kind: "label", text: "7:00 AM daily" });
    });

    it("does not apply when the schedule covers fewer than 7 days", () => {
      expect(
        computeChipState(
          inputs({
            goal: goal("week", 3),
            schedules: [someDaysAt(0b0101010, 19, 30)],
          }),
        ),
      ).toEqual({ kind: "label", text: "3× / wk" });
    });

    it("does not apply when there are multiple schedule rows", () => {
      expect(
        computeChipState(
          inputs({
            goal: goal("week", 7),
            schedules: [everyDayAt(7, 0), everyDayAt(19, 30)],
            multiSlotPerDay: true,
            todaySlots: ["done", "pending"],
          }),
        ),
      ).toEqual({
        kind: "dots",
        slots: ["done", "pending"],
        prefixToday: true,
      });
    });

    it("does not apply when the schedule has no time", () => {
      expect(
        computeChipState(
          inputs({
            goal: goal("week", 7),
            schedules: [
              { days: 0x7f, dayOfMonth: null, hour: null, minute: null },
            ],
          }),
        ),
      ).toEqual({ kind: "label", text: "7× / wk" });
    });
  });

  describe("monthly, frequency > 1", () => {
    it("renders text label like '4× / mo' — month-strip carries detail", () => {
      expect(
        computeChipState(
          inputs({ goal: goal("month", 4), periodCheckInCount: 1 }),
        ),
      ).toEqual({ kind: "label", text: "4× / mo" });
    });

    it("ignores schedule shape (still text label)", () => {
      expect(
        computeChipState(
          inputs({
            goal: goal("month", 2),
            periodCheckInCount: 1,
            hasSchedules: true,
          }),
        ),
      ).toEqual({ kind: "label", text: "2× / mo" });
    });
  });
});
