import { describe, expect, it } from "vitest";
import { dailyCalculator } from "../../trafficLight";
import { colors, oldDate, noSchedules } from "./shared";

const input = (overrides: Record<string, unknown>) => ({
  frequency: 1,
  regularity: "day" as const,
  createdAt: oldDate,
  schedules: noSchedules,
  checkInCount: 0,
  now: new Date(2025, 5, 15, 14, 0),
  ...overrides,
});

describe("dailyCalculator", () => {
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

  describe("with timed schedules", () => {
    const timedSchedules = [
      { days: null, dayOfMonth: null, hour: 8, minute: 0 },
      { days: null, dayOfMonth: null, hour: 12, minute: 0 },
      { days: null, dayOfMonth: null, hour: 18, minute: 0 },
    ];

    it("is compliant when 1 of 3 done before second schedule time", () => {
      const result = dailyCalculator(
        input({
          frequency: 3,
          schedules: timedSchedules,
          checkInCount: 1,
          now: new Date(2025, 5, 15, 10, 0),
        }),
        colors,
      );
      expect(result.color).toBe("compliant");
    });

    it("is partial when 1 of 3 done after second schedule time has passed", () => {
      const result = dailyCalculator(
        input({
          frequency: 3,
          schedules: timedSchedules,
          checkInCount: 1,
          now: new Date(2025, 5, 15, 13, 0),
        }),
        colors,
      );
      expect(result.color).toBe("partial");
    });

    it("is failing when 1 of 3 done after third schedule time has passed", () => {
      const result = dailyCalculator(
        input({
          frequency: 3,
          schedules: timedSchedules,
          checkInCount: 1,
          now: new Date(2025, 5, 15, 19, 0),
        }),
        colors,
      );
      expect(result.color).toBe("failing");
    });

    it("returns default color before first scheduled time", () => {
      const result = dailyCalculator(
        input({
          frequency: 3,
          schedules: timedSchedules,
          checkInCount: 0,
          now: new Date(2025, 5, 15, 7, 0),
        }),
        colors,
      );
      expect(result.color).toBe("default");
    });
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
