import { describe, it, expect } from "vitest";
import { isSameDay } from "date-fns";
import {
  stepCalendarDay,
  clampDayToToday,
  canStepForward,
} from "../calendarNav";

// Local-time constructor so the tests are timezone-independent: every date
// here and every date-fns helper under test operate in the same local zone.
const d = (year: number, month1: number, day: number) =>
  new Date(year, month1 - 1, day);

describe("stepCalendarDay", () => {
  describe("month view", () => {
    it("advances a month on next", () => {
      expect(
        isSameDay(
          stepCalendarDay({
            day: d(2026, 5, 15),
            view: "month",
            direction: "next",
          }),
          d(2026, 6, 15),
        ),
      ).toBe(true);
    });

    it("goes back a month on prev", () => {
      expect(
        isSameDay(
          stepCalendarDay({
            day: d(2026, 5, 15),
            view: "month",
            direction: "prev",
          }),
          d(2026, 4, 15),
        ),
      ).toBe(true);
    });

    it("rolls across a year boundary", () => {
      expect(
        isSameDay(
          stepCalendarDay({
            day: d(2026, 1, 10),
            view: "month",
            direction: "prev",
          }),
          d(2025, 12, 10),
        ),
      ).toBe(true);
    });
  });

  describe("week view", () => {
    it("advances seven days on next", () => {
      expect(
        isSameDay(
          stepCalendarDay({
            day: d(2026, 5, 1),
            view: "week",
            direction: "next",
          }),
          d(2026, 5, 8),
        ),
      ).toBe(true);
    });

    it("goes back seven days on prev", () => {
      expect(
        isSameDay(
          stepCalendarDay({
            day: d(2026, 5, 8),
            view: "week",
            direction: "prev",
          }),
          d(2026, 5, 1),
        ),
      ).toBe(true);
    });
  });

  describe("day view", () => {
    it("advances one day on next", () => {
      expect(
        isSameDay(
          stepCalendarDay({
            day: d(2026, 5, 2),
            view: "day",
            direction: "next",
          }),
          d(2026, 5, 3),
        ),
      ).toBe(true);
    });

    it("goes back one day on prev", () => {
      expect(
        isSameDay(
          stepCalendarDay({
            day: d(2026, 5, 2),
            view: "day",
            direction: "prev",
          }),
          d(2026, 5, 1),
        ),
      ).toBe(true);
    });
  });
});

describe("clampDayToToday", () => {
  const today = d(2026, 5, 28);

  it("returns the day unchanged when on or before today", () => {
    expect(
      isSameDay(clampDayToToday(d(2026, 5, 10), today), d(2026, 5, 10)),
    ).toBe(true);
    expect(isSameDay(clampDayToToday(today, today), today)).toBe(true);
  });

  it("pulls a future day back to today", () => {
    expect(isSameDay(clampDayToToday(d(2026, 7, 1), today), today)).toBe(true);
  });
});

describe("canStepForward", () => {
  describe("month view", () => {
    const today = d(2026, 5, 28);

    it("allows stepping into the current month from a past month", () => {
      expect(canStepForward(d(2026, 4, 15), "month", today)).toBe(true);
    });

    it("blocks stepping past the current month", () => {
      expect(canStepForward(d(2026, 5, 1), "month", today)).toBe(false);
    });
  });

  describe("week view", () => {
    // 2026-05-28 is a Thursday; its Monday-anchored week starts 2026-05-25.
    const today = d(2026, 5, 28);

    it("allows stepping into the current week from a past week", () => {
      expect(canStepForward(d(2026, 5, 18), "week", today)).toBe(true);
    });

    it("blocks stepping past the current week", () => {
      expect(canStepForward(d(2026, 5, 25), "week", today)).toBe(false);
    });
  });

  describe("day view", () => {
    const today = d(2026, 5, 28);

    it("always allows stepping forward (future days are read-only but viewable)", () => {
      expect(canStepForward(today, "day", today)).toBe(true);
      expect(canStepForward(d(2027, 1, 1), "day", today)).toBe(true);
    });
  });
});
