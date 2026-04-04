import { describe, expect, it } from "vitest";
import type { Regularity } from "@nag/schema";
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

  it("returns default when goal was created in current period", () => {
    const now = new Date();
    const goal = {
      frequency: 3,
      regularity: "day" as Regularity,
      createdAt: now,
    };
    expect(tileColor(goal, 0, colors)).toBe("default");
  });

  it("returns compliant when check-ins meet frequency", () => {
    const goal = {
      frequency: 3,
      regularity: "day" as Regularity,
      createdAt: new Date("2020-01-01T00:00:00.000Z"),
    };
    expect(tileColor(goal, 3, colors)).toBe("compliant");
    expect(tileColor(goal, 5, colors)).toBe("compliant");
  });

  it("returns partial when check-ins are half of frequency", () => {
    const goal = {
      frequency: 4,
      regularity: "day" as Regularity,
      createdAt: new Date("2020-01-01T00:00:00.000Z"),
    };
    expect(tileColor(goal, 2, colors)).toBe("partial");
  });

  it("returns failing when check-ins are below half", () => {
    const goal = {
      frequency: 10,
      regularity: "day" as Regularity,
      createdAt: new Date("2020-01-01T00:00:00.000Z"),
    };
    expect(tileColor(goal, 1, colors)).toBe("failing");
  });

  it("returns compliant for weekly goal meeting frequency", () => {
    const goal = {
      frequency: 3,
      regularity: "week" as Regularity,
      createdAt: new Date("2020-01-01T00:00:00.000Z"),
    };
    expect(tileColor(goal, 3, colors)).toBe("compliant");
  });

  it("returns partial for weekly goal at half frequency", () => {
    const goal = {
      frequency: 4,
      regularity: "week" as Regularity,
      createdAt: new Date("2020-01-01T00:00:00.000Z"),
    };
    expect(tileColor(goal, 2, colors)).toBe("partial");
  });

  it("returns failing for weekly goal below half", () => {
    const goal = {
      frequency: 6,
      regularity: "week" as Regularity,
      createdAt: new Date("2020-01-01T00:00:00.000Z"),
    };
    expect(tileColor(goal, 1, colors)).toBe("failing");
  });

  it("returns default for weekly goal created in current week", () => {
    const now = new Date();
    const goal = {
      frequency: 5,
      regularity: "week" as Regularity,
      createdAt: now,
    };
    expect(tileColor(goal, 0, colors)).toBe("default");
  });

  it("returns compliant for monthly goal meeting frequency", () => {
    const goal = {
      frequency: 2,
      regularity: "month" as Regularity,
      createdAt: new Date("2020-01-01T00:00:00.000Z"),
    };
    expect(tileColor(goal, 4, colors)).toBe("compliant");
  });

  it("returns partial for monthly goal at half frequency", () => {
    const goal = {
      frequency: 10,
      regularity: "month" as Regularity,
      createdAt: new Date("2020-01-01T00:00:00.000Z"),
    };
    expect(tileColor(goal, 5, colors)).toBe("partial");
  });

  it("returns failing for monthly goal below half", () => {
    const goal = {
      frequency: 20,
      regularity: "month" as Regularity,
      createdAt: new Date("2020-01-01T00:00:00.000Z"),
    };
    expect(tileColor(goal, 3, colors)).toBe("failing");
  });

  it("returns default for monthly goal created in current month", () => {
    const now = new Date();
    const goal = {
      frequency: 5,
      regularity: "month" as Regularity,
      createdAt: now,
    };
    expect(tileColor(goal, 0, colors)).toBe("default");
  });
});
