import { describe, expect, it } from "vitest";
import {
  withinDayCompliance,
  withinDayColor,
} from "../../trafficLight/withinDayCompliance";
import type { ScheduleInfo } from "../../trafficLight";
import { Day } from "../../days";
import { colors } from "./shared";

// 2025-06-15 is a Sunday
const sunday = (h: number, m = 0) => new Date(2025, 5, 15, h, m);

const threePerDay: ScheduleInfo[] = [
  { days: null, dayOfMonth: null, hour: 8, minute: 0 },
  { days: null, dayOfMonth: null, hour: 12, minute: 0 },
  { days: null, dayOfMonth: null, hour: 18, minute: 0 },
];

describe("withinDayCompliance", () => {
  describe("with three timed schedules", () => {
    it("reports zero elapsed before first scheduled time", () => {
      const result = withinDayCompliance({
        schedules: threePerDay,
        checkInTimestamps: [],
        now: sunday(7),
      });
      expect(result.elapsed).toBe(0);
      expect(result.checkInsToday).toBe(0);
      expect(result.ratio).toBeNull();
    });

    it("reports one elapsed between first and second time", () => {
      const result = withinDayCompliance({
        schedules: threePerDay,
        checkInTimestamps: [sunday(9)],
        now: sunday(10),
      });
      expect(result.elapsed).toBe(1);
      expect(result.checkInsToday).toBe(1);
      expect(result.ratio).toBe(1);
    });

    it("reports two elapsed after second time", () => {
      const result = withinDayCompliance({
        schedules: threePerDay,
        checkInTimestamps: [sunday(9)],
        now: sunday(13),
      });
      expect(result.elapsed).toBe(2);
      expect(result.ratio).toBe(0.5);
    });

    it("reports three elapsed after third time", () => {
      const result = withinDayCompliance({
        schedules: threePerDay,
        checkInTimestamps: [sunday(9)],
        now: sunday(19),
      });
      expect(result.elapsed).toBe(3);
      expect(result.ratio).toBeCloseTo(1 / 3);
    });
  });

  describe("schedule day filtering", () => {
    const monWedFri: ScheduleInfo[] = [
      {
        days: Day.Mon | Day.Wed | Day.Fri,
        dayOfMonth: null,
        hour: 8,
        minute: 0,
      },
    ];

    it("ignores schedules whose day mask excludes today", () => {
      const result = withinDayCompliance({
        schedules: monWedFri,
        checkInTimestamps: [],
        now: sunday(20), // Sunday
      });
      expect(result.elapsed).toBe(0);
      expect(result.ratio).toBeNull();
    });

    it("includes schedules whose day mask includes today", () => {
      // 2025-06-16 is Monday
      const monday = new Date(2025, 5, 16, 9, 0);
      const result = withinDayCompliance({
        schedules: monWedFri,
        checkInTimestamps: [],
        now: monday,
      });
      expect(result.elapsed).toBe(1);
      expect(result.ratio).toBe(0);
    });
  });

  it("ignores schedules without an hour (untimed)", () => {
    const result = withinDayCompliance({
      schedules: [{ days: null, dayOfMonth: null, hour: null, minute: null }],
      checkInTimestamps: [],
      now: sunday(20),
    });
    expect(result.elapsed).toBe(0);
    expect(result.ratio).toBeNull();
  });

  it("ignores check-ins from other days", () => {
    const yesterday = new Date(2025, 5, 14, 9, 0);
    const result = withinDayCompliance({
      schedules: threePerDay,
      checkInTimestamps: [yesterday],
      now: sunday(13),
    });
    expect(result.checkInsToday).toBe(0);
  });
});

describe("withinDayColor", () => {
  it("returns undefined when no timed schedules have elapsed", () => {
    expect(
      withinDayColor(
        {
          schedules: threePerDay,
          checkInTimestamps: [],
          now: sunday(7),
        },
        colors,
      ),
    ).toBeUndefined();
  });

  it("returns compliant when ratio >= 1", () => {
    expect(
      withinDayColor(
        {
          schedules: threePerDay,
          checkInTimestamps: [sunday(9)],
          now: sunday(10),
        },
        colors,
      ),
    ).toBe("compliant");
  });

  it("returns partial when ratio is 0.5", () => {
    expect(
      withinDayColor(
        {
          schedules: threePerDay,
          checkInTimestamps: [sunday(9)],
          now: sunday(13),
        },
        colors,
      ),
    ).toBe("partial");
  });

  it("returns failing when ratio < 0.5", () => {
    expect(
      withinDayColor(
        {
          schedules: threePerDay,
          checkInTimestamps: [sunday(9)],
          now: sunday(19),
        },
        colors,
      ),
    ).toBe("failing");
  });
});
