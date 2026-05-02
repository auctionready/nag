import type { Regularity } from "@nag/schema";
import type { SlotDotState } from "../slotDotState";
import { computeChipState } from "../TileProgressChip";

const goal = (regularity: Regularity, frequency: number) => ({
  regularity,
  frequency,
  title: "habit",
  createdAt: new Date(),
});

describe("computeChipState", () => {
  describe("returns null", () => {
    it("when goal is null", () => {
      expect(computeChipState(null, undefined, 0, 0)).toBeNull();
    });
  });

  describe("frequency = 1 → text label", () => {
    it("renders 'daily' for daily/freq=1", () => {
      expect(computeChipState(goal("day", 1), undefined, 0, 0)).toEqual({
        kind: "label",
        text: "daily",
      });
    });

    it("renders 'weekly' for weekly/freq=1", () => {
      expect(computeChipState(goal("week", 1), undefined, 0, 0)).toEqual({
        kind: "label",
        text: "weekly",
      });
    });

    it("renders 'monthly' for monthly/freq=1", () => {
      expect(computeChipState(goal("month", 1), undefined, 0, 0)).toEqual({
        kind: "label",
        text: "monthly",
      });
    });
  });

  describe("daily, frequency > 1", () => {
    it("uses provided todaySlots with today prefix", () => {
      const slots: SlotDotState[] = ["done", "pending", "pending"];
      expect(computeChipState(goal("day", 3), slots, 0, 0)).toEqual({
        kind: "dots",
        slots,
        prefixToday: true,
      });
    });

    it("falls back to all-pending pips when todaySlots is missing", () => {
      expect(computeChipState(goal("day", 3), undefined, 0, 0)).toEqual({
        kind: "dots",
        slots: ["pending", "pending", "pending"],
        prefixToday: true,
      });
    });
  });

  describe("weekly, frequency > 1", () => {
    it("with multi-slot-per-day uses todaySlots and 'today' prefix", () => {
      // todaySlots length > 1 means today has multiple slots → today mode.
      const slots: SlotDotState[] = ["done", "pending"];
      expect(computeChipState(goal("week", 4), slots, 1, 0)).toEqual({
        kind: "dots",
        slots,
        prefixToday: true,
      });
    });

    it("with single-slot-per-day shows N=frequency dots from week count", () => {
      // todaySlots is undefined → single-slot-per-day or unscheduled. Dots
      // are based on this week's check-in count vs frequency.
      expect(computeChipState(goal("week", 3), undefined, 2, 0)).toEqual({
        kind: "dots",
        slots: ["done", "done", "pending"],
        prefixToday: false,
      });
    });

    it("emits all-pending when no check-ins this week yet", () => {
      expect(computeChipState(goal("week", 3), undefined, 0, 0)).toEqual({
        kind: "dots",
        slots: ["pending", "pending", "pending"],
        prefixToday: false,
      });
    });

    it("emits all-done when count equals frequency", () => {
      expect(computeChipState(goal("week", 3), undefined, 3, 0)).toEqual({
        kind: "dots",
        slots: ["done", "done", "done"],
        prefixToday: false,
      });
    });

    it("appends ahead pips when count exceeds frequency", () => {
      expect(computeChipState(goal("week", 2), undefined, 4, 0)).toEqual({
        kind: "dots",
        slots: ["done", "done", "ahead", "ahead"],
        prefixToday: false,
      });
    });

    it("treats a single today slot as not multi-slot-per-day", () => {
      // todaySlots length 1 means today has just one slot — fall through to
      // week-progress mode (specific days are a guide).
      const slots: SlotDotState[] = ["done"];
      expect(computeChipState(goal("week", 3), slots, 1, 0)).toEqual({
        kind: "dots",
        slots: ["done", "pending", "pending"],
        prefixToday: false,
      });
    });
  });

  describe("monthly, frequency > 1", () => {
    it("shows N=frequency dots from month count", () => {
      expect(computeChipState(goal("month", 4), undefined, 0, 2)).toEqual({
        kind: "dots",
        slots: ["done", "done", "pending", "pending"],
        prefixToday: false,
      });
    });

    it("appends ahead pips when count exceeds frequency", () => {
      expect(computeChipState(goal("month", 2), undefined, 0, 3)).toEqual({
        kind: "dots",
        slots: ["done", "done", "ahead"],
        prefixToday: false,
      });
    });
  });
});
