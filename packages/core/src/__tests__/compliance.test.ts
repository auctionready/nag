import { describe, expect, it } from "vitest";
import {
  periodStart,
  colorForRatio,
  tileColor,
  type ComplianceColors,
} from "../compliance";

const colors: ComplianceColors = {
  default: "default",
  compliant: "compliant",
  partial: "partial",
  failing: "failing",
};

describe("periodStart", () => {
  it("returns start of day", () => {
    const now = new Date(2025, 5, 15, 14, 30); // June 15 local
    const result = periodStart("day", now);
    expect(result).toBeInstanceOf(Date);
    expect(result.getFullYear()).toBe(2025);
    expect(result.getMonth()).toBe(5);
    expect(result.getDate()).toBe(15);
    expect(result.getHours()).toBe(0);
    expect(result.getMinutes()).toBe(0);
  });

  it("returns start of week (Monday)", () => {
    const now = new Date(2025, 5, 15, 14, 30); // June 15 2025 is a Sunday
    const result = periodStart("week", now);
    expect(result.getDay()).toBe(1); // Monday
    expect(result.getDate()).toBe(9);
  });

  it("returns start of month", () => {
    const now = new Date(2025, 5, 15, 14, 30); // June 15 local
    const result = periodStart("month", now);
    expect(result.getFullYear()).toBe(2025);
    expect(result.getMonth()).toBe(5);
    expect(result.getDate()).toBe(1);
    expect(result.getHours()).toBe(0);
  });
});

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
    expect(tileColor(null, 0, colors)).toBe("default");
    expect(tileColor(null, 5, colors)).toBe("default");
  });

  describe.each(["day", "week", "month"] as const)(
    "%s regularity",
    (regularity) => {
      const oldGoal = (frequency: number) => ({
        frequency,
        regularity,
        createdAt: new Date("2020-01-01T00:00:00.000Z"),
      });

      describe("when goal was created in current period", () => {
        it("returns default", () => {
          const goal = { frequency: 3, regularity, createdAt: new Date() };
          expect(tileColor(goal, 0, colors)).toBe("default");
        });
      });

      describe("when check-ins meet frequency", () => {
        it("returns compliant", () => {
          expect(tileColor(oldGoal(3), 3, colors)).toBe("compliant");
          expect(tileColor(oldGoal(3), 5, colors)).toBe("compliant");
        });
      });

      describe("when check-ins are half of frequency", () => {
        it("returns partial", () => {
          expect(tileColor(oldGoal(4), 2, colors)).toBe("partial");
        });
      });

      describe("when check-ins are below half", () => {
        it("returns failing", () => {
          expect(tileColor(oldGoal(10), 1, colors)).toBe("failing");
        });
      });
    },
  );
});
