import { describe, expect, it } from "vitest";
import { periodStart, colorForRatio, tileColor, type ComplianceColors } from "../compliance";

const colors: ComplianceColors = {
  default: "default",
  compliant: "compliant",
  partial: "partial",
  failing: "failing",
};

describe("periodStart", () => {
  it("returns start of day", () => {
    const now = new Date("2025-06-15T14:30:00Z");
    expect(periodStart("day", now)).toBe(
      new Date("2025-06-15T00:00:00.000Z").toISOString(),
    );
  });

  it("returns start of week (Monday)", () => {
    // 2025-06-15 is a Sunday, so week start (Monday) is 2025-06-09
    const now = new Date("2025-06-15T14:30:00Z");
    const result = new Date(periodStart("week", now));
    expect(result.getDay()).toBe(1); // Monday
    expect(result.getDate()).toBe(9);
  });

  it("returns start of month", () => {
    const now = new Date("2025-06-15T14:30:00Z");
    expect(periodStart("month", now)).toBe(
      new Date("2025-06-01T00:00:00.000Z").toISOString(),
    );
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

  it("returns default when goal was created in current period", () => {
    const now = new Date();
    const goal = {
      frequency: 3,
      regularity: "day",
      createdAt: now.toISOString(),
    };
    expect(tileColor(goal, 0, colors)).toBe("default");
  });

  it("returns compliant when check-ins meet frequency", () => {
    const goal = {
      frequency: 3,
      regularity: "day",
      createdAt: "2020-01-01T00:00:00.000Z",
    };
    expect(tileColor(goal, 3, colors)).toBe("compliant");
    expect(tileColor(goal, 5, colors)).toBe("compliant");
  });

  it("returns partial when check-ins are half of frequency", () => {
    const goal = {
      frequency: 4,
      regularity: "day",
      createdAt: "2020-01-01T00:00:00.000Z",
    };
    expect(tileColor(goal, 2, colors)).toBe("partial");
  });

  it("returns failing when check-ins are below half", () => {
    const goal = {
      frequency: 10,
      regularity: "day",
      createdAt: "2020-01-01T00:00:00.000Z",
    };
    expect(tileColor(goal, 1, colors)).toBe("failing");
  });
});
