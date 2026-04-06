import { describe, expect, it } from "vitest";
import {
  colorForRatio,
  tileColor,
  dailyCalculator,
  weeklyCalculator,
  monthlyCalculator,
  type ComplianceColors,
  type ScheduleInfo,
} from "../trafficLight";

const colors: ComplianceColors = {
  default: "default",
  compliant: "compliant",
  partial: "partial",
  failing: "failing",
};

const oldDate = new Date("2020-01-01T00:00:00.000Z");

const noSchedules: ScheduleInfo[] = [];

const defaultResult = { color: "default", progress: 0, periodProgress: 0 };

describe("colorForRatio", () => {
  it("returns compliant when ratio >= 1", () => {
    expect(colorForRatio(1, colors)).toBe("compliant");
    expect(colorForRatio(1.5, colors)).toBe("compliant");
  });

  it("returns partial when ratio >= 0.5 and < 1", () => {
    expect(colorForRatio(0.5, colors)).toBe("partial");
    expect(colorForRatio(0.99, colors)).toBe("partial");
  });

  it("returns failing when ratio < 0.5", () => {
    expect(colorForRatio(0, colors)).toBe("failing");
    expect(colorForRatio(0.49, colors)).toBe("failing");
  });
});

describe("tileColor", () => {
  it("returns default with zero progress when goal is null", () => {
    expect(tileColor(null, 0, noSchedules, colors)).toEqual(defaultResult);
    expect(tileColor(null, 5, noSchedules, colors)).toEqual(defaultResult);
  });
});

describe("dailyCalculator", () => {
  const input = (overrides: Record<string, unknown>) => ({
    frequency: 1,
    regularity: "day" as const,
    createdAt: oldDate,
    schedules: noSchedules,
    checkInCount: 0,
    now: new Date(2025, 5, 15, 14, 0),
    ...overrides,
  });

  it("returns default color but still tracks periodProgress when goal created today", () => {
    const now = new Date(2025, 5, 15, 14, 0);
    const result = dailyCalculator(
      input({ createdAt: now, frequency: 3, checkInCount: 2 }),
      colors,
    );
    expect(result.color).toBe("default");
    expect(result.progress).toBe(0);
    expect(result.periodProgress).toBeCloseTo(2 / 3);
  });

  it("returns compliant when check-ins meet frequency", () => {
    const result = dailyCalculator(input({ checkInCount: 1 }), colors);
    expect(result.color).toBe("compliant");
    expect(result.progress).toBe(1);
    expect(result.periodProgress).toBe(1);
  });

  it("clamps progress to 1 when check-ins exceed frequency", () => {
    const result = dailyCalculator(
      input({ frequency: 2, checkInCount: 3 }),
      colors,
    );
    expect(result.progress).toBe(1);
    expect(result.periodProgress).toBe(1);
  });

  it("progress and periodProgress are the same for daily", () => {
    const result = dailyCalculator(
      input({ frequency: 4, checkInCount: 2 }),
      colors,
    );
    expect(result.color).toBe("partial");
    expect(result.progress).toBe(0.5);
    expect(result.periodProgress).toBe(0.5);
  });
});

describe("weeklyCalculator", () => {
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

describe("monthlyCalculator", () => {
  const june15 = new Date(2025, 5, 15, 14, 0);

  const input = (overrides: Record<string, unknown>) => ({
    frequency: 2,
    regularity: "month" as const,
    createdAt: oldDate,
    schedules: noSchedules,
    checkInCount: 0,
    now: june15,
    ...overrides,
  });

  it("returns default color but still tracks periodProgress when goal created this month", () => {
    const june5 = new Date(2025, 5, 5, 10, 0);
    const result = monthlyCalculator(
      input({ createdAt: june5, checkInCount: 1 }),
      colors,
    );
    expect(result.color).toBe("default");
    expect(result.progress).toBe(0);
    expect(result.periodProgress).toBe(0.5);
  });

  describe("with specific schedule (1st and 15th)", () => {
    const firstAndFifteenth: ScheduleInfo[] = [
      { days: null, dayOfMonth: 1 },
      { days: null, dayOfMonth: 15 },
    ];

    it("on June 15, 2/2 expected = compliant, periodProgress 1", () => {
      const result = monthlyCalculator(
        input({ schedules: firstAndFifteenth, checkInCount: 2 }),
        colors,
      );
      expect(result.color).toBe("compliant");
      expect(result.progress).toBe(1);
      expect(result.periodProgress).toBe(1);
    });

    it("on June 15, 1/2 expected = partial, periodProgress 0.5", () => {
      const result = monthlyCalculator(
        input({ schedules: firstAndFifteenth, checkInCount: 1 }),
        colors,
      );
      expect(result.color).toBe("partial");
      expect(result.progress).toBe(0.5);
      expect(result.periodProgress).toBe(0.5);
    });

    it("on June 10, 1/1 expected = compliant, periodProgress 0.5", () => {
      const june10 = new Date(2025, 5, 10, 14, 0);
      const result = monthlyCalculator(
        input({
          schedules: firstAndFifteenth,
          checkInCount: 1,
          now: june10,
        }),
        colors,
      );
      expect(result.color).toBe("compliant");
      expect(result.progress).toBe(1);
      expect(result.periodProgress).toBe(0.5);
    });

    it("on June 10, 0/1 expected = failing, periodProgress 0", () => {
      const june10 = new Date(2025, 5, 10, 14, 0);
      const result = monthlyCalculator(
        input({
          schedules: firstAndFifteenth,
          checkInCount: 0,
          now: june10,
        }),
        colors,
      );
      expect(result.color).toBe("failing");
      expect(result.progress).toBe(0);
      expect(result.periodProgress).toBe(0);
    });
  });

  describe("without schedule (sliding window)", () => {
    it("on June 15 with frequency 4, expects 2", () => {
      const compliant = monthlyCalculator(
        input({ frequency: 4, checkInCount: 2 }),
        colors,
      );
      expect(compliant.color).toBe("compliant");
      expect(compliant.progress).toBe(1);
      expect(compliant.periodProgress).toBe(0.5);

      const partial = monthlyCalculator(
        input({ frequency: 4, checkInCount: 1 }),
        colors,
      );
      expect(partial.color).toBe("partial");
      expect(partial.progress).toBe(0.5);
      expect(partial.periodProgress).toBe(0.25);
    });

    it("on June 1 with frequency 4, expects 1", () => {
      const june1 = new Date(2025, 5, 1, 14, 0);
      const result = monthlyCalculator(
        input({ frequency: 4, checkInCount: 1, now: june1 }),
        colors,
      );
      expect(result.color).toBe("compliant");
      expect(result.progress).toBe(1);
      expect(result.periodProgress).toBe(0.25);
    });
  });
});
