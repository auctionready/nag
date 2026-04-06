import { describe, expect, it } from "vitest";
import { Day } from "../../days";
import { isScheduledToday } from "../../trafficLight";
import type { ScheduleInfo } from "../../trafficLight";

const scheduleWithDays = (days: number): ScheduleInfo[] => [
  { days, dayOfMonth: null },
];

describe("isScheduledToday", () => {
  describe("when no schedules exist", () => {
    it("returns true", () => {
      expect(isScheduledToday([])).toBe(true);
    });
  });

  describe("when schedules have no days set", () => {
    it("returns true", () => {
      expect(isScheduledToday([{ days: 0, dayOfMonth: null }])).toBe(true);
    });
  });

  describe("when today is a scheduled day", () => {
    it("returns true for Monday", () => {
      // Monday = getDay() 1, Day.Mon = 1<<1
      const monday = new Date("2026-04-06T12:00:00"); // 2026-04-06 is Monday
      expect(isScheduledToday(scheduleWithDays(Day.Mon), monday)).toBe(true);
    });

    it("returns true for Sunday", () => {
      const sunday = new Date("2026-04-05T12:00:00"); // Sunday
      expect(isScheduledToday(scheduleWithDays(Day.Sun), sunday)).toBe(true);
    });
  });

  describe("when today is not a scheduled day", () => {
    it("returns false for Monday when only Tuesday is scheduled", () => {
      const monday = new Date("2026-04-06T12:00:00");
      expect(isScheduledToday(scheduleWithDays(Day.Tue), monday)).toBe(false);
    });

    it("returns false for Wednesday when Mon and Fri are scheduled", () => {
      const wednesday = new Date("2026-04-08T12:00:00");
      expect(
        isScheduledToday(scheduleWithDays(Day.Mon | Day.Fri), wednesday),
      ).toBe(false);
    });
  });

  describe("when multiple schedules are combined", () => {
    it("combines day bitmasks from all schedules", () => {
      const monday = new Date("2026-04-06T12:00:00");
      const schedules: ScheduleInfo[] = [
        { days: Day.Tue, dayOfMonth: null },
        { days: Day.Mon, dayOfMonth: null },
      ];
      expect(isScheduledToday(schedules, monday)).toBe(true);
    });
  });
});
