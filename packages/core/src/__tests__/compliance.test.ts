import { describe, expect, it } from "vitest";
import { periodStart } from "../compliance";

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
