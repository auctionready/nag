import type { Regularity } from "@nag/schema";
import type { SlotDotState } from "../slotDotState";
import { computeChipState } from "../TileProgressChip";

const goal = (regularity: Regularity, frequency: number) => ({
  regularity,
  frequency,
  title: "habit",
  createdAt: new Date(),
});

const inputs = (overrides: {
  goal: ReturnType<typeof goal> | null;
  todaySlots?: SlotDotState[];
  periodCheckInCount?: number;
  multiSlotPerDay?: boolean;
}) => ({
  todaySlots: undefined,
  periodCheckInCount: 0,
  multiSlotPerDay: false,
  ...overrides,
});

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
    it("uses provided todaySlots with today prefix", () => {
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

  describe("weekly, frequency > 1", () => {
    it("with multi-slot-per-day uses todaySlots and 'today' prefix", () => {
      // Schedule has 2+ slots on at least one day-of-week → today mode.
      const slots: SlotDotState[] = ["done", "pending", "pending"];
      expect(
        computeChipState(
          inputs({
            goal: goal("week", 9),
            todaySlots: slots,
            multiSlotPerDay: true,
          }),
        ),
      ).toEqual({ kind: "dots", slots, prefixToday: true });
    });

    it("with multi-slot-per-day shows just one dot when today has one slot", () => {
      // Detection comes from the schedule shape, not today's slot count, so
      // a one-slot day under a multi-slot-per-day schedule still uses today
      // mode (one dot) rather than collapsing to N=frequency week dots.
      const slots: SlotDotState[] = ["done"];
      expect(
        computeChipState(
          inputs({
            goal: goal("week", 9),
            todaySlots: slots,
            multiSlotPerDay: true,
          }),
        ),
      ).toEqual({ kind: "dots", slots, prefixToday: true });
    });

    it("with multi-slot-per-day on an off day shows 'off today' label", () => {
      // No slots today (off day) under a multi-slot-per-day schedule —
      // dots wouldn't make sense, so fall back to a clear label.
      expect(
        computeChipState(
          inputs({ goal: goal("week", 9), multiSlotPerDay: true }),
        ),
      ).toEqual({ kind: "label", text: "off today" });
    });

    it("with single-slot-per-day shows N=frequency dots from week count", () => {
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
      expect(computeChipState(inputs({ goal: goal("week", 3) }))).toEqual({
        kind: "dots",
        slots: ["pending", "pending", "pending"],
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

    it("with single-slot-per-day ignores todaySlots", () => {
      // Today happens to have a slot but the schedule isn't multi-slot/day.
      // Specific scheduled days are a guide — dots track week progress.
      const slots: SlotDotState[] = ["done"];
      expect(
        computeChipState(
          inputs({
            goal: goal("week", 3),
            todaySlots: slots,
            periodCheckInCount: 1,
          }),
        ),
      ).toEqual({
        kind: "dots",
        slots: ["done", "pending", "pending"],
        prefixToday: false,
      });
    });
  });

  describe("monthly, frequency > 1", () => {
    it("shows N=frequency dots from period count", () => {
      expect(
        computeChipState(
          inputs({ goal: goal("month", 4), periodCheckInCount: 1 }),
        ),
      ).toEqual({
        kind: "dots",
        slots: ["done", "pending", "pending", "pending"],
        prefixToday: false,
      });
    });

    it("appends ahead pips when count exceeds frequency", () => {
      expect(
        computeChipState(
          inputs({ goal: goal("month", 2), periodCheckInCount: 3 }),
        ),
      ).toEqual({
        kind: "dots",
        slots: ["done", "done", "ahead"],
        prefixToday: false,
      });
    });
  });
});
