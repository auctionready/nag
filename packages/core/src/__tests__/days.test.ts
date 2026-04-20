import { describe, expect, it } from "vitest";
import { isSameCalendarDay } from "../days";

describe("isSameCalendarDay", () => {
  it("returns true for two times on the same calendar day", () => {
    const a = new Date(2025, 5, 15, 0, 0, 0);
    const b = new Date(2025, 5, 15, 23, 59, 59);
    expect(isSameCalendarDay(a, b)).toBe(true);
  });

  it("returns false when days differ", () => {
    const a = new Date(2025, 5, 15, 23, 59, 59);
    const b = new Date(2025, 5, 16, 0, 0, 0);
    expect(isSameCalendarDay(a, b)).toBe(false);
  });

  it("returns false when months differ", () => {
    const a = new Date(2025, 5, 30);
    const b = new Date(2025, 6, 30);
    expect(isSameCalendarDay(a, b)).toBe(false);
  });

  it("returns false when years differ", () => {
    const a = new Date(2024, 5, 15);
    const b = new Date(2025, 5, 15);
    expect(isSameCalendarDay(a, b)).toBe(false);
  });
});
