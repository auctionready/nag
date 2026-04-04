import { buildGoalPayload } from "../buildGoalPayload";
import type { HabitFormData } from "../../components/HabitForm";

const baseData: HabitFormData = {
  title: "Exercise",
  description: "",
  regularity: "none",
  frequency: "1",
  schedules: [],
};

describe("buildGoalPayload", () => {
  describe("when regularity is none", () => {
    it("returns undefined", () => {
      expect(
        buildGoalPayload({ ...baseData, regularity: "none" }),
      ).toBeUndefined();
    });
  });

  describe("when regularity is a frequency type", () => {
    it.each(["day", "week", "month"] as const)(
      "returns regularity %s with numeric frequency",
      (regularity) => {
        const result = buildGoalPayload({
          ...baseData,
          regularity,
          frequency: "3",
        });
        expect(result).toEqual({ regularity, frequency: 3 });
      },
    );

    it("coerces string frequency to number", () => {
      const result = buildGoalPayload({
        ...baseData,
        regularity: "day",
        frequency: "7",
      });
      expect(result).toEqual({ regularity: "day", frequency: 7 });
    });
  });

  describe("when regularity is scheduled", () => {
    it("returns week regularity with mapped schedules", () => {
      const result = buildGoalPayload({
        ...baseData,
        regularity: "scheduled",
        schedules: [{ hour: "9", minute: "30", days: 42, reminder: true }],
      });
      expect(result).toEqual({
        regularity: "week",
        schedules: [{ hour: 9, minute: 30, days: 42, reminder: true }],
      });
    });

    it("coerces hour and minute strings to numbers", () => {
      const result = buildGoalPayload({
        ...baseData,
        regularity: "scheduled",
        schedules: [{ hour: "14", minute: "05", days: 127 }],
      });
      expect(result!.schedules![0].hour).toBe(14);
      expect(result!.schedules![0].minute).toBe(5);
    });

    it("defaults reminder to true when undefined", () => {
      const result = buildGoalPayload({
        ...baseData,
        regularity: "scheduled",
        schedules: [{ hour: "9", minute: "00", days: 127 }],
      });
      expect(result!.schedules![0].reminder).toBe(true);
    });

    it("preserves reminder: false", () => {
      const result = buildGoalPayload({
        ...baseData,
        regularity: "scheduled",
        schedules: [{ hour: "9", minute: "00", days: 127, reminder: false }],
      });
      expect(result!.schedules![0].reminder).toBe(false);
    });

    it("maps multiple schedule entries", () => {
      const result = buildGoalPayload({
        ...baseData,
        regularity: "scheduled",
        schedules: [
          { hour: "8", minute: "00", days: 2, reminder: true },
          { hour: "18", minute: "30", days: 32, reminder: false },
        ],
      });
      expect(result!.schedules).toHaveLength(2);
      expect(result!.schedules![0]).toEqual({
        hour: 8,
        minute: 0,
        days: 2,
        reminder: true,
      });
      expect(result!.schedules![1]).toEqual({
        hour: 18,
        minute: 30,
        days: 32,
        reminder: false,
      });
    });
  });
});
