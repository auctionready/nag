import { describe, expect, it } from "vitest";
import { weeklyCalculator, type ScheduleInfo } from "../../trafficLight";
import { colors, oldDate, noSchedules } from "./shared";

// June 11 2025 is a Wednesday (week starts Mon June 9)
const wednesday = new Date(2025, 5, 11, 14, 0);
// Day enum bits: Sun=1, Mon=2, Tue=4, Wed=8, Thu=16, Fri=32, Sat=64
const monWedFri: ScheduleInfo[] = [{ days: 2 | 8 | 32, dayOfMonth: null }];

const input = (overrides: Record<string, unknown>) => ({
  frequency: 3,
  regularity: "week" as const,
  createdAt: oldDate,
  schedules: noSchedules,
  checkInCount: 0,
  now: wednesday,
  ...overrides,
});

describe("weeklyCalculator", () => {
  it("returns default color but still tracks periodProgress when goal created this week", () => {
    const monday = new Date(2025, 5, 9, 10, 0);
    const result = weeklyCalculator(
      input({ createdAt: monday, checkInCount: 1 }),
      colors,
    );
    expect(result.color).toBe("default");
    expect(result.progress).toBe(0);
    expect(result.periodProgress).toBeCloseTo(1 / 3);
  });

  describe("with specific schedule (Mon/Wed/Fri)", () => {
    it("on Wednesday, expects 1 (Mon completed), 2 check-ins = compliant", () => {
      const result = weeklyCalculator(
        input({ schedules: monWedFri, checkInCount: 2 }),
        colors,
      );
      expect(result.color).toBe("compliant");
      expect(result.progress).toBe(1);
      expect(result.periodProgress).toBeCloseTo(2 / 3);
    });

    it("on Wednesday, expects 1 (Mon completed), 0 check-ins = failing", () => {
      const result = weeklyCalculator(
        input({ schedules: monWedFri, checkInCount: 0 }),
        colors,
      );
      expect(result.color).toBe("failing");
      expect(result.progress).toBe(0);
      expect(result.periodProgress).toBe(0);
    });

    it("on Monday, expects 0 (today in progress) = default, periodProgress tracks check-ins", () => {
      const monday = new Date(2025, 5, 9, 14, 0);
      const result = weeklyCalculator(
        input({ schedules: monWedFri, checkInCount: 1, now: monday }),
        colors,
      );
      expect(result.color).toBe("default");
      expect(result.progress).toBe(0);
      expect(result.periodProgress).toBeCloseTo(1 / 3);
    });

    it("on Monday with 0 check-ins, stays default (not yet behind)", () => {
      const monday = new Date(2025, 5, 9, 14, 0);
      const result = weeklyCalculator(
        input({ schedules: monWedFri, checkInCount: 0, now: monday }),
        colors,
      );
      expect(result.color).toBe("default");
      expect(result.progress).toBe(0);
      expect(result.periodProgress).toBe(0);
    });

    it("on Friday, expects 2 (Mon+Wed completed), 3 check-ins = compliant", () => {
      const friday = new Date(2025, 5, 13, 14, 0);
      const result = weeklyCalculator(
        input({ schedules: monWedFri, checkInCount: 3, now: friday }),
        colors,
      );
      expect(result.color).toBe("compliant");
      expect(result.progress).toBe(1);
      expect(result.periodProgress).toBe(1);
    });

    it("on Friday, expects 2 (Mon+Wed completed), 1 check-in = partial", () => {
      const friday = new Date(2025, 5, 13, 14, 0);
      const result = weeklyCalculator(
        input({ schedules: monWedFri, checkInCount: 1, now: friday }),
        colors,
      );
      expect(result.color).toBe("partial");
      expect(result.progress).toBe(0.5);
      expect(result.periodProgress).toBeCloseTo(1 / 3);
    });

    it("on Tuesday (no scheduled day), expects 1 (Mon completed), 1 check-in = compliant", () => {
      const tuesday = new Date(2025, 5, 10, 14, 0);
      const result = weeklyCalculator(
        input({ schedules: monWedFri, checkInCount: 1, now: tuesday }),
        colors,
      );
      expect(result.color).toBe("compliant");
      expect(result.progress).toBe(1);
      expect(result.periodProgress).toBeCloseTo(1 / 3);
    });

    it("on Tuesday with 0 check-ins (Mon was scheduled and missed) = failing", () => {
      const tuesday = new Date(2025, 5, 10, 14, 0);
      const result = weeklyCalculator(
        input({ schedules: monWedFri, checkInCount: 0, now: tuesday }),
        colors,
      );
      expect(result.color).toBe("failing");
      expect(result.progress).toBe(0);
      expect(result.periodProgress).toBe(0);
    });
  });

  describe("without schedule (sliding window)", () => {
    it("on Monday (0 days completed) with frequency 7, expects 0 = default", () => {
      const monday = new Date(2025, 5, 9, 14, 0);
      const result = weeklyCalculator(
        input({ frequency: 7, checkInCount: 1, now: monday }),
        colors,
      );
      expect(result.color).toBe("default");
      expect(result.progress).toBe(0);
      expect(result.periodProgress).toBeCloseTo(1 / 7);
    });

    it("on Monday with 0 check-ins stays default (not yet behind)", () => {
      const monday = new Date(2025, 5, 9, 14, 0);
      const result = weeklyCalculator(
        input({ frequency: 3, checkInCount: 0, now: monday }),
        colors,
      );
      expect(result.color).toBe("default");
      expect(result.progress).toBe(0);
      expect(result.periodProgress).toBe(0);
    });

    it("on Wednesday (2 days completed) with frequency 3, expects 1", () => {
      const compliant = weeklyCalculator(
        input({ frequency: 3, checkInCount: 2 }),
        colors,
      );
      expect(compliant.color).toBe("compliant");
      expect(compliant.progress).toBe(1);
      expect(compliant.periodProgress).toBeCloseTo(2 / 3);

      const stillCompliant = weeklyCalculator(
        input({ frequency: 3, checkInCount: 1 }),
        colors,
      );
      expect(stillCompliant.color).toBe("compliant");
      expect(stillCompliant.progress).toBe(1);
      expect(stillCompliant.periodProgress).toBeCloseTo(1 / 3);
    });

    it("on Friday (4 days completed) with frequency 3, expects 2 (partial when 1 done)", () => {
      const friday = new Date(2025, 5, 13, 14, 0);
      const partial = weeklyCalculator(
        input({ frequency: 3, checkInCount: 1, now: friday }),
        colors,
      );
      expect(partial.color).toBe("partial");
      expect(partial.progress).toBe(0.5);
      expect(partial.periodProgress).toBeCloseTo(1 / 3);
    });

    it("on Sunday (6 days completed) with frequency 3, expects 3", () => {
      const sunday = new Date(2025, 5, 15, 14, 0);
      const result = weeklyCalculator(
        input({ frequency: 3, checkInCount: 3, now: sunday }),
        colors,
      );
      expect(result.color).toBe("compliant");
      expect(result.progress).toBe(1);
      expect(result.periodProgress).toBe(1);
    });
  });
});
