import { describe, expect, it } from "vitest";
import { buildMonthCells } from "../monthCells";

// 2025-03-15 — mid-month, a Saturday
const mid = new Date(2025, 2, 15, 12, 0);

const checkIn = (day: number) => ({ timestamp: new Date(2025, 2, day, 9, 0) });

describe("buildMonthCells", () => {
  it("returns 31 cells for March", () => {
    const cells = buildMonthCells([], mid);
    expect(cells).toHaveLength(31);
  });

  it("numbers cells 1–31", () => {
    const cells = buildMonthCells([], mid);
    expect(cells.map((c) => c.dayNumber)).toEqual(
      Array.from({ length: 31 }, (_, i) => i + 1),
    );
  });

  it("classifies past, today, and future correctly", () => {
    const cells = buildMonthCells([], mid);
    expect(cells[0]).toMatchObject({
      dayNumber: 1,
      isPast: true,
      isToday: false,
      isFuture: false,
    });
    expect(cells[14]).toMatchObject({
      dayNumber: 15,
      isPast: false,
      isToday: true,
      isFuture: false,
    });
    expect(cells[30]).toMatchObject({
      dayNumber: 31,
      isPast: false,
      isToday: false,
      isFuture: true,
    });
  });

  it("marks hasCheckIn only for days with a check-in", () => {
    const cells = buildMonthCells([checkIn(1), checkIn(15), checkIn(31)], mid);
    expect(cells[0].hasCheckIn).toBe(true);
    expect(cells[14].hasCheckIn).toBe(true);
    expect(cells[30].hasCheckIn).toBe(true);
    expect(cells[1].hasCheckIn).toBe(false);
  });

  it("multiple check-ins on the same day still marks hasCheckIn once", () => {
    const cells = buildMonthCells([checkIn(5), checkIn(5)], mid);
    expect(cells[4].hasCheckIn).toBe(true);
  });

  it("returns 28 cells for February in a non-leap year", () => {
    const feb = new Date(2025, 1, 10, 12, 0);
    expect(buildMonthCells([], feb)).toHaveLength(28);
  });
});
