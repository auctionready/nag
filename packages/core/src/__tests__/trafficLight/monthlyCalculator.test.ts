import { describe, expect, it } from "vitest";
import { monthlyCalculator, type ScheduleInfo } from "../../trafficLight";
import { colors, oldDate, noSchedules } from "./shared";

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

describe("monthlyCalculator", () => {
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
