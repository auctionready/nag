import { Day } from "@nag/core";
import type { ScheduleInfo } from "@nag/core";
import { computeRingProgress } from "../computeRingProgress";

// Tuesday, 2025-06-03 14:00 local
const TUESDAY = new Date(2025, 5, 3, 14, 0);
// Wednesday, 2025-06-04 14:00 local
const WEDNESDAY = new Date(2025, 5, 4, 14, 0);

const dayMaskSchedule = (days: number): ScheduleInfo => ({
  days,
  dayOfMonth: null,
  hour: null,
  minute: null,
});

const timedSchedule = (
  days: number,
  hour: number,
  minute = 0,
): ScheduleInfo => ({
  days,
  dayOfMonth: null,
  hour,
  minute,
});

describe("computeRingProgress", () => {
  describe("non-scheduled habits", () => {
    it("returns periodProgress when hasSchedule is false", () => {
      const progress = computeRingProgress({
        hasSchedule: false,
        scheduledDaysMask: 0,
        schedules: [],
        recentCheckIns: [],
        frequency: 3,
        periodProgress: 0.42,
        now: TUESDAY,
      });
      expect(progress).toBe(0.42);
    });
  });

  describe("scheduled day-mask-only habits", () => {
    const monWedFri = Day.Mon | Day.Wed | Day.Fri;
    const schedules = [dayMaskSchedule(monWedFri)];

    it("returns 0 when today is not a scheduled day", () => {
      const progress = computeRingProgress({
        hasSchedule: true,
        scheduledDaysMask: monWedFri,
        schedules,
        recentCheckIns: [],
        frequency: 3,
        periodProgress: 0.1,
        now: TUESDAY, // not in Mon/Wed/Fri
      });
      expect(progress).toBe(0);
    });

    it("returns 0 when today is scheduled but no check-ins yet", () => {
      const progress = computeRingProgress({
        hasSchedule: true,
        scheduledDaysMask: monWedFri,
        schedules,
        recentCheckIns: [],
        frequency: 3,
        periodProgress: 0.5,
        now: WEDNESDAY,
      });
      expect(progress).toBe(0);
    });

    it("returns 1 when today has its required check-in (1/day)", () => {
      const progress = computeRingProgress({
        hasSchedule: true,
        scheduledDaysMask: monWedFri,
        schedules,
        recentCheckIns: [{ timestamp: new Date(2025, 5, 4, 9, 0) }],
        frequency: 3,
        periodProgress: 0.33,
        now: WEDNESDAY,
      });
      expect(progress).toBe(1);
    });

    it("splits frequency across scheduled days (2/day)", () => {
      const progress = computeRingProgress({
        hasSchedule: true,
        scheduledDaysMask: monWedFri,
        schedules,
        recentCheckIns: [{ timestamp: new Date(2025, 5, 4, 9, 0) }],
        frequency: 6, // 6/week over 3 days = 2/day
        periodProgress: 0.17,
        now: WEDNESDAY,
      });
      expect(progress).toBe(0.5);
    });

    it("clamps today's progress to 1 when extra check-ins happen", () => {
      const progress = computeRingProgress({
        hasSchedule: true,
        scheduledDaysMask: monWedFri,
        schedules,
        recentCheckIns: [
          { timestamp: new Date(2025, 5, 4, 9, 0) },
          { timestamp: new Date(2025, 5, 4, 12, 0) },
          { timestamp: new Date(2025, 5, 4, 15, 0) },
        ],
        frequency: 3,
        periodProgress: 1,
        now: WEDNESDAY,
      });
      expect(progress).toBe(1);
    });

    it("ignores check-ins from other days", () => {
      const progress = computeRingProgress({
        hasSchedule: true,
        scheduledDaysMask: monWedFri,
        schedules,
        recentCheckIns: [
          { timestamp: new Date(2025, 5, 2, 9, 0) }, // Monday
          { timestamp: new Date(2025, 5, 4, 9, 0) }, // Wednesday
        ],
        frequency: 3,
        periodProgress: 0.67,
        now: WEDNESDAY,
      });
      expect(progress).toBe(1);
    });
  });

  describe("scheduled habits with timed schedules", () => {
    it("uses the count of today's timed schedules as denominator", () => {
      const schedules = [
        timedSchedule(Day.Mon | Day.Wed | Day.Fri, 8),
        timedSchedule(Day.Mon | Day.Wed | Day.Fri, 14),
        timedSchedule(Day.Mon | Day.Wed | Day.Fri, 20),
      ];
      const progress = computeRingProgress({
        hasSchedule: true,
        scheduledDaysMask: Day.Mon | Day.Wed | Day.Fri,
        schedules,
        recentCheckIns: [
          { timestamp: new Date(2025, 5, 4, 8, 5) },
          { timestamp: new Date(2025, 5, 4, 14, 10) },
        ],
        frequency: 9,
        periodProgress: 0.22,
        now: WEDNESDAY,
      });
      // 2 of 3 timed schedules done today
      expect(progress).toBeCloseTo(2 / 3);
    });

    it("ignores timed schedules whose day mask excludes today", () => {
      const schedules = [timedSchedule(Day.Mon, 8), timedSchedule(Day.Wed, 14)];
      const progress = computeRingProgress({
        hasSchedule: true,
        scheduledDaysMask: Day.Mon | Day.Wed,
        schedules,
        recentCheckIns: [{ timestamp: new Date(2025, 5, 4, 14, 0) }],
        frequency: 2,
        periodProgress: 0.5,
        now: WEDNESDAY,
      });
      // Only Wed's single timed slot counts today → 1/1
      expect(progress).toBe(1);
    });
  });
});
