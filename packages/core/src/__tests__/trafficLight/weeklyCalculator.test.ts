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
    it("on Wednesday, 2/2 expected = compliant, periodProgress 2/3", () => {
      const result = weeklyCalculator(
        input({ schedules: monWedFri, checkInCount: 2 }),
        colors,
      );
      expect(result.color).toBe("compliant");
      expect(result.progress).toBe(1);
      expect(result.periodProgress).toBeCloseTo(2 / 3);
    });

    it("on Wednesday, 1/2 expected = partial, periodProgress 1/3", () => {
      const result = weeklyCalculator(
        input({ schedules: monWedFri, checkInCount: 1 }),
        colors,
      );
      expect(result.color).toBe("partial");
      expect(result.progress).toBe(0.5);
      expect(result.periodProgress).toBeCloseTo(1 / 3);
    });

    it("on Wednesday, 0/2 expected = failing, periodProgress 0", () => {
      const result = weeklyCalculator(
        input({ schedules: monWedFri, checkInCount: 0 }),
        colors,
      );
      expect(result.color).toBe("failing");
      expect(result.progress).toBe(0);
      expect(result.periodProgress).toBe(0);
    });

    it("on Monday, 1/1 expected = compliant, periodProgress 1/3", () => {
      const monday = new Date(2025, 5, 9, 14, 0);
      const result = weeklyCalculator(
        input({ schedules: monWedFri, checkInCount: 1, now: monday }),
        colors,
      );
      expect(result.color).toBe("compliant");
      expect(result.progress).toBe(1);
      expect(result.periodProgress).toBeCloseTo(1 / 3);
    });

    it("on Friday, 3/3 expected = compliant, periodProgress 1", () => {
      const friday = new Date(2025, 5, 13, 14, 0);
      const result = weeklyCalculator(
        input({ schedules: monWedFri, checkInCount: 3, now: friday }),
        colors,
      );
      expect(result.color).toBe("compliant");
      expect(result.progress).toBe(1);
      expect(result.periodProgress).toBe(1);
    });

    it("on Friday, 2/3 expected = partial, periodProgress 2/3", () => {
      const friday = new Date(2025, 5, 13, 14, 0);
      const result = weeklyCalculator(
        input({ schedules: monWedFri, checkInCount: 2, now: friday }),
        colors,
      );
      expect(result.color).toBe("partial");
      expect(result.progress).toBeCloseTo(2 / 3);
      expect(result.periodProgress).toBeCloseTo(2 / 3);
    });

    it("on Tuesday (no scheduled day), 1 expected, periodProgress 1/3", () => {
      const tuesday = new Date(2025, 5, 10, 14, 0);
      const result = weeklyCalculator(
        input({ schedules: monWedFri, checkInCount: 1, now: tuesday }),
        colors,
      );
      expect(result.color).toBe("compliant");
      expect(result.progress).toBe(1);
      expect(result.periodProgress).toBeCloseTo(1 / 3);
    });
  });

  describe("without schedule (sliding window)", () => {
    it("frequency 2 with 1 check-in gives periodProgress 0.5", () => {
      const result = weeklyCalculator(
        input({ frequency: 2, checkInCount: 1 }),
        colors,
      );
      expect(result.periodProgress).toBe(0.5);
    });

    it("on Monday (day 1/7) with frequency 7, expects 1", () => {
      const monday = new Date(2025, 5, 9, 14, 0);
      const result = weeklyCalculator(
        input({ frequency: 7, checkInCount: 1, now: monday }),
        colors,
      );
      expect(result.color).toBe("compliant");
      expect(result.progress).toBe(1);
      expect(result.periodProgress).toBeCloseTo(1 / 7);
    });

    it("on Wednesday (day 3/7) with frequency 3, expects 2", () => {
      const compliant = weeklyCalculator(
        input({ frequency: 3, checkInCount: 2 }),
        colors,
      );
      expect(compliant.color).toBe("compliant");
      expect(compliant.progress).toBe(1);
      expect(compliant.periodProgress).toBeCloseTo(2 / 3);

      const partial = weeklyCalculator(
        input({ frequency: 3, checkInCount: 1 }),
        colors,
      );
      expect(partial.color).toBe("partial");
      expect(partial.progress).toBe(0.5);
      expect(partial.periodProgress).toBeCloseTo(1 / 3);
    });

    it("on Sunday (day 7/7) with frequency 3, expects 3", () => {
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
