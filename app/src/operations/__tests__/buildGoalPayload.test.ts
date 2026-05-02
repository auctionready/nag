import { buildGoalPayload } from "../buildGoalPayload";
import type { HabitFormData } from "../../components/HabitForm";

const baseData: HabitFormData = {
  title: "Exercise",
  description: "",
  icon: null,
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

    describe("with a string frequency", () => {
      let result: ReturnType<typeof buildGoalPayload>;

      beforeEach(() => {
        result = buildGoalPayload({
          ...baseData,
          regularity: "day",
          frequency: "7",
        });
      });

      it("coerces to a number", () => {
        expect(result).toEqual({ regularity: "day", frequency: 7 });
      });
    });
  });

  describe("when regularity is scheduled", () => {
    describe("with a single schedule entry", () => {
      let result: ReturnType<typeof buildGoalPayload>;

      beforeEach(() => {
        result = buildGoalPayload({
          ...baseData,
          regularity: "scheduled",
          schedules: [{ hour: "9", minute: "30", days: 42, reminder: true }],
        });
      });

      it("returns week regularity", () => {
        expect(result!.regularity).toBe("week");
      });

      it("coerces hour and minute strings to numbers", () => {
        expect(result!.schedules![0].hour).toBe(9);
        expect(result!.schedules![0].minute).toBe(30);
      });

      it("preserves days and reminder", () => {
        expect(result!.schedules![0].days).toBe(42);
        expect(result!.schedules![0].reminder).toBe(true);
      });
    });

    describe("when reminder is undefined", () => {
      let result: ReturnType<typeof buildGoalPayload>;

      beforeEach(() => {
        result = buildGoalPayload({
          ...baseData,
          regularity: "scheduled",
          schedules: [{ hour: "9", minute: "00", days: 127 }],
        });
      });

      it("defaults reminder to true", () => {
        expect(result!.schedules![0].reminder).toBe(true);
      });
    });

    describe("when reminder is explicitly false", () => {
      let result: ReturnType<typeof buildGoalPayload>;

      beforeEach(() => {
        result = buildGoalPayload({
          ...baseData,
          regularity: "scheduled",
          schedules: [{ hour: "9", minute: "00", days: 127, reminder: false }],
        });
      });

      it("preserves reminder: false", () => {
        expect(result!.schedules![0].reminder).toBe(false);
      });
    });

    describe("with multiple schedule entries", () => {
      let result: ReturnType<typeof buildGoalPayload>;

      beforeEach(() => {
        result = buildGoalPayload({
          ...baseData,
          regularity: "scheduled",
          schedules: [
            { hour: "8", minute: "00", days: 2, reminder: true },
            { hour: "18", minute: "30", days: 32, reminder: false },
          ],
        });
      });

      it("maps all entries", () => {
        expect(result!.schedules).toHaveLength(2);
      });

      it("converts first entry correctly", () => {
        expect(result!.schedules![0]).toEqual({
          hour: 8,
          minute: 0,
          days: 2,
          reminder: true,
        });
      });

      it("converts second entry correctly", () => {
        expect(result!.schedules![1]).toEqual({
          hour: 18,
          minute: 30,
          days: 32,
          reminder: false,
        });
      });
    });
  });
});
