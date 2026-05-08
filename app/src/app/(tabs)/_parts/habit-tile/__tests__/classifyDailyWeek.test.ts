import { Day } from "@nag/core";
import { classifyDailyWeek } from "../classifyDailyWeek";

// Helper: build a check-in pinned to a given day-of-week (0=Sun..6=Sat) at noon.
const checkInOn = (dayOfWeek: number) => {
  // 2026-05-03 is a Sunday; +dayOfWeek lands on the corresponding day.
  const d = new Date(2026, 4, 3 + dayOfWeek, 12, 0, 0);
  return { timestamp: d };
};

describe("classifyDailyWeek", () => {
  describe("frequency = 1", () => {
    it("marks any day with a check-in as completed", () => {
      const { completedDaysMask, partialDaysMask } = classifyDailyWeek(
        [checkInOn(1), checkInOn(3)],
        1,
      );
      expect(completedDaysMask).toBe(Day.Mon | Day.Wed);
      expect(partialDaysMask).toBe(0);
    });

    it("returns empty masks when no check-ins", () => {
      const { completedDaysMask, partialDaysMask } = classifyDailyWeek([], 1);
      expect(completedDaysMask).toBe(0);
      expect(partialDaysMask).toBe(0);
    });
  });

  describe("frequency > 1 (multi-slot daily)", () => {
    it("marks a day as completed when count meets the target", () => {
      const { completedDaysMask, partialDaysMask } = classifyDailyWeek(
        [checkInOn(2), checkInOn(2), checkInOn(2)],
        3,
      );
      expect(completedDaysMask).toBe(Day.Tue);
      expect(partialDaysMask).toBe(0);
    });

    it("marks a day as completed when count exceeds the target", () => {
      const { completedDaysMask, partialDaysMask } = classifyDailyWeek(
        [checkInOn(2), checkInOn(2), checkInOn(2), checkInOn(2)],
        3,
      );
      expect(completedDaysMask).toBe(Day.Tue);
      expect(partialDaysMask).toBe(0);
    });

    it("marks a day as partial when count is between 1 and target-1", () => {
      const { completedDaysMask, partialDaysMask } = classifyDailyWeek(
        [checkInOn(4), checkInOn(4)],
        3,
      );
      expect(completedDaysMask).toBe(0);
      expect(partialDaysMask).toBe(Day.Thu);
    });

    it("classifies each day independently", () => {
      const { completedDaysMask, partialDaysMask } = classifyDailyWeek(
        [
          checkInOn(0),
          checkInOn(0),
          checkInOn(0), // Sun: 3 → done
          checkInOn(2),
          checkInOn(2), // Tue: 2 → partial
          checkInOn(5), // Fri: 1 → partial
        ],
        3,
      );
      expect(completedDaysMask).toBe(Day.Sun);
      expect(partialDaysMask).toBe(Day.Tue | Day.Fri);
    });
  });

  describe("invalid frequency", () => {
    it("treats frequency <= 0 as 1", () => {
      const { completedDaysMask, partialDaysMask } = classifyDailyWeek(
        [checkInOn(3)],
        0,
      );
      expect(completedDaysMask).toBe(Day.Wed);
      expect(partialDaysMask).toBe(0);
    });
  });
});
