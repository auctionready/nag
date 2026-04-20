import { describe, expect, it } from "vitest";
import { periodStart, periodWindow } from "../compliance";

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

describe("periodWindow", () => {
  it("day: start and end of today", () => {
    const now = new Date(2025, 5, 15, 14, 30);
    const { start, end } = periodWindow("day", now);
    expect(start.getDate()).toBe(15);
    expect(start.getHours()).toBe(0);
    expect(end.getDate()).toBe(15);
    expect(end.getHours()).toBe(23);
    expect(end.getMinutes()).toBe(59);
  });

  it("week: Monday start, end clamped to end-of-today", () => {
    const now = new Date(2025, 5, 15, 14, 30); // Sunday June 15 2025
    const { start, end } = periodWindow("week", now);
    expect(start.getDay()).toBe(1); // Monday
    expect(start.getDate()).toBe(9);
    // end is end-of-day(now), not end-of-week
    expect(end.getDate()).toBe(15);
    expect(end.getHours()).toBe(23);
  });

  it("month: full month window", () => {
    const now = new Date(2025, 5, 15, 14, 30);
    const { start, end } = periodWindow("month", now);
    expect(start.getDate()).toBe(1);
    expect(start.getHours()).toBe(0);
    expect(end.getDate()).toBe(30); // June has 30 days
    expect(end.getHours()).toBe(23);
  });

  it("null regularity falls back to day", () => {
    const now = new Date(2025, 5, 15, 14, 30);
    const { start, end } = periodWindow(null, now);
    expect(start.getDate()).toBe(15);
    expect(start.getHours()).toBe(0);
    expect(end.getDate()).toBe(15);
    expect(end.getHours()).toBe(23);
  });
});
