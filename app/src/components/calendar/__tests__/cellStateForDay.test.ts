import { Day } from "@nag/core";
import { cellStateForDay } from "../cellStateForDay";

describe("cellStateForDay", () => {
  const PAST = "past" as const;
  const TODAY = "today" as const;
  const FUTURE = "future" as const;

  describe("future days", () => {
    it("always returns 'future' regardless of any other input", () => {
      expect(
        cellStateForDay({
          checkIns: [{ skipped: false }],
          scheduledDaysMask: 0,
          frequency: 1,
          dayOfWeek: 3,
          dayKind: FUTURE,
        }),
      ).toBe("future");
    });
  });

  describe("today", () => {
    it("returns 'today-done' when done >= target", () => {
      expect(
        cellStateForDay({
          checkIns: [{ skipped: false }, { skipped: false }],
          scheduledDaysMask: Day.Wed,
          frequency: 2,
          dayOfWeek: 3,
          dayKind: TODAY,
        }),
      ).toBe("today-done");
    });

    it("returns 'today-partial' when 0 < done < target", () => {
      expect(
        cellStateForDay({
          checkIns: [{ skipped: false }],
          scheduledDaysMask: Day.Wed,
          frequency: 3,
          dayOfWeek: 3,
          dayKind: TODAY,
        }),
      ).toBe("today-partial");
    });

    it("returns 'today' when nothing logged yet", () => {
      expect(
        cellStateForDay({
          checkIns: [],
          scheduledDaysMask: Day.Wed,
          frequency: 1,
          dayOfWeek: 3,
          dayKind: TODAY,
        }),
      ).toBe("today");
    });

    it("ignores skipped check-ins for completion math", () => {
      expect(
        cellStateForDay({
          checkIns: [{ skipped: true }, { skipped: true }],
          scheduledDaysMask: Day.Wed,
          frequency: 1,
          dayOfWeek: 3,
          dayKind: TODAY,
        }),
      ).toBe("today");
    });
  });

  describe("past, scheduled day", () => {
    it("returns 'done' when target met", () => {
      expect(
        cellStateForDay({
          checkIns: [{ skipped: false }, { skipped: false }],
          scheduledDaysMask: Day.Tue,
          frequency: 2,
          dayOfWeek: 2,
          dayKind: PAST,
        }),
      ).toBe("done");
    });

    it("returns 'partial' when count is between 1 and target-1", () => {
      expect(
        cellStateForDay({
          checkIns: [{ skipped: false }],
          scheduledDaysMask: Day.Tue,
          frequency: 3,
          dayOfWeek: 2,
          dayKind: PAST,
        }),
      ).toBe("partial");
    });

    it("returns 'missed' when no check-ins on a scheduled day", () => {
      expect(
        cellStateForDay({
          checkIns: [],
          scheduledDaysMask: Day.Tue,
          frequency: 1,
          dayOfWeek: 2,
          dayKind: PAST,
        }),
      ).toBe("missed");
    });

    it("returns 'skipped' when only skip check-ins exist", () => {
      expect(
        cellStateForDay({
          checkIns: [{ skipped: true }, { skipped: true }],
          scheduledDaysMask: Day.Tue,
          frequency: 1,
          dayOfWeek: 2,
          dayKind: PAST,
        }),
      ).toBe("skipped");
    });
  });

  describe("past, scheduled-off day", () => {
    it("returns 'unscheduled' when off-day with no check-ins", () => {
      expect(
        cellStateForDay({
          checkIns: [],
          // habit is scheduled M-F; querying Sunday
          scheduledDaysMask: Day.Mon | Day.Tue | Day.Wed | Day.Thu | Day.Fri,
          frequency: 1,
          dayOfWeek: 0,
          dayKind: PAST,
        }),
      ).toBe("unscheduled");
    });

    it("still credits a check-in logged on an off-day as 'done'", () => {
      expect(
        cellStateForDay({
          checkIns: [{ skipped: false }],
          scheduledDaysMask: Day.Mon,
          frequency: 1,
          dayOfWeek: 0,
          dayKind: PAST,
        }),
      ).toBe("done");
    });
  });

  describe("habit with no schedule (mask = 0)", () => {
    it("treats every day as schedulable, so a missed past day is 'missed'", () => {
      expect(
        cellStateForDay({
          checkIns: [],
          scheduledDaysMask: 0,
          frequency: 1,
          dayOfWeek: 4,
          dayKind: PAST,
        }),
      ).toBe("missed");
    });
  });
});
