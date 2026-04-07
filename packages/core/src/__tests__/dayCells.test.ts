import { describe, expect, it } from "vitest";
import { buildDayCells } from "../dayCells";
import { Day } from "../days";

const GREEN = "#34C759";
const ORANGE = "#FF9500";

// 2025-06-16 is Monday
const monday = (h = 12) => new Date(2025, 5, 16, h, 0);
// 2025-06-15 is Sunday
const sunday = (h = 12) => new Date(2025, 5, 15, h, 0);

describe("buildDayCells", () => {
  it("returns seven Monday-first cells", () => {
    const cells = buildDayCells({
      scheduledDaysMask: 0,
      checkedInDaysMask: 0,
      checkedInColor: GREEN,
      now: monday(),
    });
    expect(cells.map((c) => c.letter)).toEqual([
      "M",
      "T",
      "W",
      "T",
      "F",
      "S",
      "S",
    ]);
  });

  it("marks scheduled days", () => {
    const cells = buildDayCells({
      scheduledDaysMask: Day.Mon | Day.Wed,
      checkedInDaysMask: 0,
      checkedInColor: GREEN,
      now: sunday(),
    });
    expect(cells[0].scheduled).toBe(true); // Mon
    expect(cells[1].scheduled).toBe(false); // Tue
    expect(cells[2].scheduled).toBe(true); // Wed
  });

  it("fills checked-in scheduled days with checkedInColor", () => {
    const cells = buildDayCells({
      scheduledDaysMask: Day.Mon | Day.Wed,
      checkedInDaysMask: Day.Mon,
      checkedInColor: GREEN,
      now: sunday(),
    });
    expect(cells[0].backgroundColor).toBe(GREEN);
    expect(cells[2].backgroundColor).toBeUndefined();
  });

  it("does not fill unscheduled checked-in days", () => {
    const cells = buildDayCells({
      scheduledDaysMask: Day.Mon,
      checkedInDaysMask: Day.Tue,
      checkedInColor: GREEN,
      now: sunday(),
    });
    expect(cells[1].backgroundColor).toBeUndefined();
  });

  it("uses todayColor for today's scheduled cell", () => {
    const cells = buildDayCells({
      scheduledDaysMask: Day.Mon,
      checkedInDaysMask: Day.Mon,
      checkedInColor: GREEN,
      todayColor: ORANGE,
      now: monday(),
    });
    expect(cells[0].backgroundColor).toBe(ORANGE);
  });

  it("ignores todayColor when today is not scheduled", () => {
    const cells = buildDayCells({
      scheduledDaysMask: Day.Tue,
      checkedInDaysMask: 0,
      checkedInColor: GREEN,
      todayColor: ORANGE,
      now: monday(),
    });
    expect(cells[0].backgroundColor).toBeUndefined();
  });

  it("falls back to checked-in color when todayColor is undefined", () => {
    const cells = buildDayCells({
      scheduledDaysMask: Day.Mon,
      checkedInDaysMask: Day.Mon,
      checkedInColor: GREEN,
      now: monday(),
    });
    expect(cells[0].backgroundColor).toBe(GREEN);
  });
});
