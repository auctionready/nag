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
  it("returns default when goal is null", () => {
    expect(tileColor(null, 0, noSchedules, colors)).toBe("default");
    expect(tileColor(null, 5, noSchedules, colors)).toBe("default");
  });
});

describe("dailyCalculator", () => {
  const input = (overrides: Record<string, unknown>) => ({
    frequency: 1,
    regularity: "day" as const,
    createdAt: oldDate,
    schedules: noSchedules,
    checkInCount: 0,
    now: new Date(2025, 5, 15, 14, 0), // June 15 2pm
    ...overrides,
  });

  it("returns default when goal created today", () => {
    const now = new Date(2025, 5, 15, 14, 0);
    expect(dailyCalculator(input({ createdAt: now }), colors)).toBe("default");
  });

  it("returns compliant when check-ins meet frequency", () => {
    expect(dailyCalculator(input({ checkInCount: 1 }), colors)).toBe(
      "compliant",
    );
    expect(
      dailyCalculator(input({ frequency: 2, checkInCount: 2 }), colors),
    ).toBe("compliant");
  });

  it("returns partial when check-ins are half of frequency", () => {
    expect(
      dailyCalculator(input({ frequency: 4, checkInCount: 2 }), colors),
    ).toBe("partial");
  });

  it("returns failing when check-ins below half", () => {
    expect(
      dailyCalculator(input({ frequency: 4, checkInCount: 1 }), colors),
    ).toBe("failing");
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

  it("returns default when goal created this week", () => {
    // Monday June 9
    const monday = new Date(2025, 5, 9, 10, 0);
    expect(weeklyCalculator(input({ createdAt: monday }), colors)).toBe(
      "default",
    );
  });

  describe("with specific schedule (Mon/Wed/Fri)", () => {
    it("on Wednesday, expects 2 check-ins (Mon + Wed elapsed)", () => {
      // 2 check-ins out of 2 expected = compliant
      expect(
        weeklyCalculator(
          input({ schedules: monWedFri, checkInCount: 2 }),
          colors,
        ),
      ).toBe("compliant");
    });

    it("on Wednesday, 1 check-in out of 2 expected = partial", () => {
      expect(
        weeklyCalculator(
          input({ schedules: monWedFri, checkInCount: 1 }),
          colors,
        ),
      ).toBe("partial");
    });

    it("on Wednesday, 0 check-ins out of 2 expected = failing", () => {
      expect(
        weeklyCalculator(
          input({ schedules: monWedFri, checkInCount: 0 }),
          colors,
        ),
      ).toBe("failing");
    });

    it("on Monday, expects 1 check-in (only Mon elapsed)", () => {
      const monday = new Date(2025, 5, 9, 14, 0);
      expect(
        weeklyCalculator(
          input({ schedules: monWedFri, checkInCount: 1, now: monday }),
          colors,
        ),
      ).toBe("compliant");
    });

    it("on Monday, 0 check-ins = failing", () => {
      const monday = new Date(2025, 5, 9, 14, 0);
      expect(
        weeklyCalculator(
          input({ schedules: monWedFri, checkInCount: 0, now: monday }),
          colors,
        ),
      ).toBe("failing");
    });

    it("on Friday, expects 3 check-ins (Mon + Wed + Fri)", () => {
      const friday = new Date(2025, 5, 13, 14, 0);
      expect(
        weeklyCalculator(
          input({ schedules: monWedFri, checkInCount: 3, now: friday }),
          colors,
        ),
      ).toBe("compliant");

      expect(
        weeklyCalculator(
          input({ schedules: monWedFri, checkInCount: 2, now: friday }),
          colors,
        ),
      ).toBe("partial");
    });

    it("on Tuesday (no scheduled day), still expects 1 (Mon elapsed)", () => {
      const tuesday = new Date(2025, 5, 10, 14, 0);
      expect(
        weeklyCalculator(
          input({ schedules: monWedFri, checkInCount: 1, now: tuesday }),
          colors,
        ),
      ).toBe("compliant");

      expect(
        weeklyCalculator(
          input({ schedules: monWedFri, checkInCount: 0, now: tuesday }),
          colors,
        ),
      ).toBe("failing");
    });
  });

  describe("without schedule (sliding window)", () => {
    it("on Monday (day 1/7) with frequency 7, expects ceil(7*1/7)=1", () => {
      const monday = new Date(2025, 5, 9, 14, 0);
      expect(
        weeklyCalculator(
          input({ frequency: 7, checkInCount: 1, now: monday }),
          colors,
        ),
      ).toBe("compliant");
    });

    it("on Wednesday (day 3/7) with frequency 3, expects ceil(3*3/7)=2", () => {
      expect(
        weeklyCalculator(input({ frequency: 3, checkInCount: 2 }), colors),
      ).toBe("compliant");

      expect(
        weeklyCalculator(input({ frequency: 3, checkInCount: 1 }), colors),
      ).toBe("partial");
    });

    it("on Sunday (day 7/7) with frequency 3, expects ceil(3*7/7)=3", () => {
      const sunday = new Date(2025, 5, 15, 14, 0);
      expect(
        weeklyCalculator(
          input({ frequency: 3, checkInCount: 3, now: sunday }),
          colors,
        ),
      ).toBe("compliant");
    });
  });
});

describe("monthlyCalculator", () => {
  // June 15 2025
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

  it("returns default when goal created this month", () => {
    const june5 = new Date(2025, 5, 5, 10, 0);
    expect(monthlyCalculator(input({ createdAt: june5 }), colors)).toBe(
      "default",
    );
  });

  describe("with specific schedule (1st and 15th)", () => {
    const firstAndFifteenth: ScheduleInfo[] = [
      { days: null, dayOfMonth: 1 },
      { days: null, dayOfMonth: 15 },
    ];

    it("on June 15, expects 2 (both 1st and 15th elapsed)", () => {
      expect(
        monthlyCalculator(
          input({ schedules: firstAndFifteenth, checkInCount: 2 }),
          colors,
        ),
      ).toBe("compliant");
    });

    it("on June 15, 1 out of 2 expected = partial", () => {
      expect(
        monthlyCalculator(
          input({ schedules: firstAndFifteenth, checkInCount: 1 }),
          colors,
        ),
      ).toBe("partial");
    });

    it("on June 10, expects 1 (only 1st elapsed)", () => {
      const june10 = new Date(2025, 5, 10, 14, 0);
      expect(
        monthlyCalculator(
          input({
            schedules: firstAndFifteenth,
            checkInCount: 1,
            now: june10,
          }),
          colors,
        ),
      ).toBe("compliant");
    });

    it("on June 10, 0 check-ins with 1 expected = failing", () => {
      const june10 = new Date(2025, 5, 10, 14, 0);
      expect(
        monthlyCalculator(
          input({
            schedules: firstAndFifteenth,
            checkInCount: 0,
            now: june10,
          }),
          colors,
        ),
      ).toBe("failing");
    });
  });

  describe("without schedule (sliding window)", () => {
    it("on June 15 with frequency 4, expects ceil(4*15/30)=2", () => {
      expect(
        monthlyCalculator(input({ frequency: 4, checkInCount: 2 }), colors),
      ).toBe("compliant");

      expect(
        monthlyCalculator(input({ frequency: 4, checkInCount: 1 }), colors),
      ).toBe("partial");
    });

    it("on June 1 with frequency 4, expects max(1, ceil(4*1/30))=1", () => {
      const june1 = new Date(2025, 5, 1, 14, 0);
      expect(
        monthlyCalculator(
          input({ frequency: 4, checkInCount: 1, now: june1 }),
          colors,
        ),
      ).toBe("compliant");
    });
  });
});
