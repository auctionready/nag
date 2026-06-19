import { AllDays, WeekDays, NoDays, Day } from "@nag/core";
import { cadenceSummary } from "../cadenceSummary";

describe("cadenceSummary", () => {
  describe("no goal", () => {
    it("returns null when regularity is missing", () => {
      expect(
        cadenceSummary({ regularity: null, frequency: 1, schedules: [] }),
      ).toBeNull();
    });

    it("returns null when frequency is missing", () => {
      expect(
        cadenceSummary({ regularity: "week", frequency: null, schedules: [] }),
      ).toBeNull();
    });
  });

  describe("unscheduled frequency goals", () => {
    it("labels a once-weekly goal 'weekly'", () => {
      expect(
        cadenceSummary({ regularity: "week", frequency: 1, schedules: [] }),
      ).toBe("weekly");
    });

    it("labels a daily goal 'daily'", () => {
      expect(
        cadenceSummary({ regularity: "day", frequency: 1, schedules: [] }),
      ).toBe("daily");
    });

    it("labels a 3×/week goal '3× / wk'", () => {
      expect(
        cadenceSummary({ regularity: "week", frequency: 3, schedules: [] }),
      ).toBe("3× / wk");
    });
  });

  describe("scheduled every day", () => {
    // A weekly goal whose single slot fires on all seven days is stored with
    // frequency 7 (popcount of the day-mask). It should read as a daily habit,
    // not "7× / wk" / "weekly".
    it("labels '8am every day' as daily, not weekly", () => {
      expect(
        cadenceSummary({
          regularity: "week",
          frequency: 7,
          schedules: [{ days: AllDays, hour: 8, minute: 0 }],
        }),
      ).toBe("daily · 8:00 am");
    });

    it("treats a null/zero day-mask as every day", () => {
      expect(
        cadenceSummary({
          regularity: "week",
          frequency: 7,
          schedules: [{ days: NoDays, hour: 8, minute: 0 }],
        }),
      ).toBe("daily · 8:00 am");
    });

    it("collapses two every-day slots to 'Nx / day'", () => {
      expect(
        cadenceSummary({
          regularity: "week",
          frequency: 14,
          schedules: [
            { days: AllDays, hour: 8, minute: 0 },
            { days: AllDays, hour: 20, minute: 0 },
          ],
        }),
      ).toBe("2× / day · 8:00 am · 8:00 pm");
    });

    it("does not append a redundant 'every day' day-label", () => {
      const summary = cadenceSummary({
        regularity: "week",
        frequency: 7,
        schedules: [{ days: AllDays, hour: 9, minute: 30 }],
      });
      expect(summary).not.toContain("every day");
    });
  });

  describe("scheduled on specific days", () => {
    it("keeps the weekly cadence and friendly day-label for weekdays", () => {
      expect(
        cadenceSummary({
          regularity: "week",
          frequency: 5,
          schedules: [{ days: WeekDays, hour: 8, minute: 0 }],
        }),
      ).toBe("5× / wk · 8:00 am · weekdays");
    });

    it("does not collapse to daily when one slot misses a day", () => {
      const mwf = Day.Mon | Day.Wed | Day.Fri;
      expect(
        cadenceSummary({
          regularity: "week",
          frequency: 3,
          schedules: [{ days: mwf, hour: 8, minute: 0 }],
        }),
      ).toBe("3× / wk · 8:00 am");
    });
  });
});
