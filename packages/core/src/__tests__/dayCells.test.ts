import { describe, expect, it } from "vitest";
import {
  buildDayCells,
  checkInDaysMask,
  classifyScheduledDays,
} from "../dayCells";
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

  it("uses todayColor for today's scheduled cell when not yet checked in", () => {
    const cells = buildDayCells({
      scheduledDaysMask: Day.Mon,
      checkedInDaysMask: 0,
      checkedInColor: GREEN,
      todayColor: ORANGE,
      now: monday(),
    });
    expect(cells[0].backgroundColor).toBe(ORANGE);
  });

  it("prefers checkedInColor over todayColor when today is fully completed", () => {
    const cells = buildDayCells({
      scheduledDaysMask: Day.Mon,
      checkedInDaysMask: Day.Mon,
      checkedInColor: GREEN,
      todayColor: ORANGE,
      now: monday(),
    });
    expect(cells[0].backgroundColor).toBe(GREEN);
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

  describe("partialColor for partially-completed scheduled days", () => {
    it("paints past partial days orange", () => {
      // Mon scheduled with 3 slots, only 1 done → partial.
      const cells = buildDayCells({
        scheduledDaysMask: Day.Mon | Day.Wed,
        checkedInDaysMask: 0,
        partialDaysMask: Day.Mon,
        checkedInColor: GREEN,
        partialColor: ORANGE,
        missedColor: RED,
        now: thursday(),
      });
      expect(cells[0].backgroundColor).toBe(ORANGE); // Mon — partial
      expect(cells[2].backgroundColor).toBe(RED); // Wed — past, missed
    });

    it("prefers checkedInColor when a day is fully complete", () => {
      const cells = buildDayCells({
        scheduledDaysMask: Day.Mon,
        checkedInDaysMask: Day.Mon,
        partialDaysMask: Day.Mon, // overlap shouldn't happen, but guard
        checkedInColor: GREEN,
        partialColor: ORANGE,
        now: thursday(),
      });
      expect(cells[0].backgroundColor).toBe(GREEN);
    });

    it("does not paint partial today (todayColor wins)", () => {
      const cells = buildDayCells({
        scheduledDaysMask: Day.Wed,
        checkedInDaysMask: 0,
        partialDaysMask: Day.Wed,
        checkedInColor: GREEN,
        partialColor: ORANGE,
        todayColor: ORANGE, // would be passed by `withinDayColor` anyway
        now: wednesday(),
      });
      // todayColor takes precedence (== ORANGE here, but the path is the
      // todayOverride branch — assert by passing a different todayColor).
      const cellsWithGreenToday = buildDayCells({
        scheduledDaysMask: Day.Wed,
        checkedInDaysMask: 0,
        partialDaysMask: Day.Wed,
        checkedInColor: GREEN,
        partialColor: ORANGE,
        todayColor: GREEN,
        now: wednesday(),
      });
      expect(cells[2].backgroundColor).toBe(ORANGE);
      expect(cellsWithGreenToday[2].backgroundColor).toBe(GREEN);
    });

    it("falls back to checkedInColor when partialColor isn't provided", () => {
      // Partial means *some* check-ins exist — never paint missed (red).
      // Callers that haven't opted into partial-aware UI get legacy
      // "any check-in = green" behaviour.
      const cells = buildDayCells({
        scheduledDaysMask: Day.Mon,
        checkedInDaysMask: 0,
        partialDaysMask: Day.Mon,
        checkedInColor: GREEN,
        missedColor: RED,
        now: thursday(),
      });
      expect(cells[0].backgroundColor).toBe(GREEN);
    });
  });
});

describe("classifyScheduledDays", () => {
  // 2025-06-13 is a real Friday; using calendar dates ensures getDay()
  // produces the expected day-of-week index.

  it("marks a day complete when all its scheduled slots have a check-in", () => {
    const result = classifyScheduledDays({
      schedules: [
        { hour: 8, minute: 0, days: Day.Mon, dayOfMonth: null },
        { hour: 12, minute: 0, days: Day.Mon, dayOfMonth: null },
      ],
      checkIns: [
        // Mon Jun 16 = day 16, two check-ins → fully complete.
        { timestamp: new Date(2025, 5, 16, 8, 0) },
        { timestamp: new Date(2025, 5, 16, 12, 0) },
      ],
    });
    expect(result.completedDaysMask & Day.Mon).toBeTruthy();
    expect(result.partialDaysMask & Day.Mon).toBeFalsy();
  });

  it("marks a day partial when some but not all slots have check-ins", () => {
    const result = classifyScheduledDays({
      schedules: [
        { hour: 8, minute: 0, days: Day.Mon, dayOfMonth: null },
        { hour: 12, minute: 0, days: Day.Mon, dayOfMonth: null },
        { hour: 18, minute: 0, days: Day.Mon, dayOfMonth: null },
      ],
      checkIns: [
        // 1 of 3 → partial.
        { timestamp: new Date(2025, 5, 16, 8, 0) },
      ],
    });
    expect(result.partialDaysMask & Day.Mon).toBeTruthy();
    expect(result.completedDaysMask & Day.Mon).toBeFalsy();
  });

  it("treats schedules with `days = 0` as applying every day", () => {
    const result = classifyScheduledDays({
      schedules: [
        { hour: 8, minute: 0, days: null, dayOfMonth: null },
        { hour: 12, minute: 0, days: null, dayOfMonth: null },
        { hour: 18, minute: 0, days: null, dayOfMonth: null },
      ],
      checkIns: [
        // Friday: 2 of 3 done → partial.
        { timestamp: new Date(2025, 5, 13, 8, 0) },
        { timestamp: new Date(2025, 5, 13, 12, 0) },
        // Saturday: 3 of 3 done → complete.
        { timestamp: new Date(2025, 5, 14, 8, 0) },
        { timestamp: new Date(2025, 5, 14, 12, 0) },
        { timestamp: new Date(2025, 5, 14, 18, 0) },
      ],
    });
    expect(result.partialDaysMask & Day.Fri).toBeTruthy();
    expect(result.completedDaysMask & Day.Sat).toBeTruthy();
    expect(result.completedDaysMask & Day.Fri).toBeFalsy();
  });

  it("ignores days with no scheduled slots", () => {
    const result = classifyScheduledDays({
      schedules: [{ hour: 8, minute: 0, days: Day.Mon, dayOfMonth: null }],
      checkIns: [
        // Tuesday check-in but Tuesday isn't scheduled.
        { timestamp: new Date(2025, 5, 17, 8, 0) },
      ],
    });
    expect(result.partialDaysMask & Day.Tue).toBeFalsy();
    expect(result.completedDaysMask & Day.Tue).toBeFalsy();
  });

  it("counts extras as complete (>= slots)", () => {
    const result = classifyScheduledDays({
      schedules: [{ hour: 8, minute: 0, days: Day.Mon, dayOfMonth: null }],
      checkIns: [
        { timestamp: new Date(2025, 5, 16, 8, 0) },
        { timestamp: new Date(2025, 5, 16, 9, 0) }, // extra
      ],
    });
    expect(result.completedDaysMask & Day.Mon).toBeTruthy();
  });
});

describe("checkInDaysMask", () => {
  it("returns 0 for an empty list", () => {
    expect(checkInDaysMask([])).toBe(0);
  });

  it("sets the bit for a single check-in's day-of-week", () => {
    // 2025-06-16 is Monday
    expect(checkInDaysMask([{ timestamp: new Date(2025, 5, 16, 8, 0) }])).toBe(
      Day.Mon,
    );
  });

  it("deduplicates multiple check-ins on the same day", () => {
    expect(
      checkInDaysMask([
        { timestamp: new Date(2025, 5, 16, 8, 0) },
        { timestamp: new Date(2025, 5, 16, 12, 0) },
        { timestamp: new Date(2025, 5, 16, 18, 0) },
      ]),
    ).toBe(Day.Mon);
  });

  it("ORs bits for check-ins across distinct days", () => {
    // Mon=Jun 16, Wed=Jun 18, Fri=Jun 20
    expect(
      checkInDaysMask([
        { timestamp: new Date(2025, 5, 16, 8, 0) },
        { timestamp: new Date(2025, 5, 18, 8, 0) },
        { timestamp: new Date(2025, 5, 20, 8, 0) },
      ]),
    ).toBe(Day.Mon | Day.Wed | Day.Fri);
  });
});
