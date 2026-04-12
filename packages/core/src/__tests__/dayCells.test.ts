import { describe, expect, it } from "vitest";
import { buildDayCells } from "../dayCells";
import { Day } from "../days";

const GREEN = "#34C759";
const ORANGE = "#FF9500";
const RED = "#FF3B30";

// 2025-06-16 is Monday
const monday = (h = 12) => new Date(2025, 5, 16, h, 0);
// 2025-06-15 is Sunday
const sunday = (h = 12) => new Date(2025, 5, 15, h, 0);
// 2025-06-18 is Wednesday
const wednesday = (h = 12) => new Date(2025, 5, 18, h, 0);
// 2025-06-19 is Thursday
const thursday = (h = 12) => new Date(2025, 5, 19, h, 0);

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

  describe("missedColor for past scheduled days", () => {
    it("marks all past scheduled days with no check-in as missed", () => {
      // Schedule Mon/Wed/Fri, now is Thursday, no check-ins
      const cells = buildDayCells({
        scheduledDaysMask: Day.Mon | Day.Wed | Day.Fri,
        checkedInDaysMask: 0,
        checkedInColor: GREEN,
        missedColor: RED,
        now: thursday(),
      });
      expect(cells[0].backgroundColor).toBe(RED); // Mon – past, missed
      expect(cells[2].backgroundColor).toBe(RED); // Wed – past, missed
      expect(cells[4].backgroundColor).toBeUndefined(); // Fri – future
    });

    it("only marks unchecked past days as missed", () => {
      // Schedule Mon/Wed/Fri, now is Thursday, checked in Mon only
      const cells = buildDayCells({
        scheduledDaysMask: Day.Mon | Day.Wed | Day.Fri,
        checkedInDaysMask: Day.Mon,
        checkedInColor: GREEN,
        missedColor: RED,
        now: thursday(),
      });
      expect(cells[0].backgroundColor).toBe(GREEN); // Mon – checked in
      expect(cells[2].backgroundColor).toBe(RED); // Wed – past, missed
      expect(cells[4].backgroundColor).toBeUndefined(); // Fri – future
    });

    it("does not mark today as missed even without todayColor", () => {
      // Schedule Mon/Wed, now is Wednesday, no check-ins, no todayColor
      const cells = buildDayCells({
        scheduledDaysMask: Day.Mon | Day.Wed,
        checkedInDaysMask: 0,
        checkedInColor: GREEN,
        missedColor: RED,
        now: wednesday(),
      });
      expect(cells[0].backgroundColor).toBe(RED); // Mon – past, missed
      expect(cells[2].backgroundColor).toBeUndefined(); // Wed – today, not past
    });

    it("uses todayColor for today while marking past days as missed", () => {
      // Schedule Mon/Wed, now is Wednesday, no check-ins, todayColor=ORANGE
      const cells = buildDayCells({
        scheduledDaysMask: Day.Mon | Day.Wed,
        checkedInDaysMask: 0,
        checkedInColor: GREEN,
        missedColor: RED,
        todayColor: ORANGE,
        now: wednesday(),
      });
      expect(cells[0].backgroundColor).toBe(RED); // Mon – past, missed
      expect(cells[2].backgroundColor).toBe(ORANGE); // Wed – today, todayColor
    });

    it("leaves past scheduled days unfilled when missedColor is not provided", () => {
      const cells = buildDayCells({
        scheduledDaysMask: Day.Mon | Day.Wed,
        checkedInDaysMask: 0,
        checkedInColor: GREEN,
        now: thursday(),
      });
      expect(cells[0].backgroundColor).toBeUndefined();
      expect(cells[2].backgroundColor).toBeUndefined();
    });

    it("marks all prior weekdays as missed on Sunday", () => {
      // Schedule Mon/Fri, now is Sunday, no check-ins
      const cells = buildDayCells({
        scheduledDaysMask: Day.Mon | Day.Fri,
        checkedInDaysMask: 0,
        checkedInColor: GREEN,
        missedColor: RED,
        now: sunday(),
      });
      expect(cells[0].backgroundColor).toBe(RED); // Mon – past
      expect(cells[4].backgroundColor).toBe(RED); // Fri – past
    });
  });
});
