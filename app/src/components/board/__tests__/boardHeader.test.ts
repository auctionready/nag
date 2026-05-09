import type { BoardProgressResult } from "@nag/core";
import { boardHeaderText } from "../boardHeader";

const result = (
  overrides: Partial<BoardProgressResult>,
): BoardProgressResult => ({
  expected: 0,
  done: 0,
  extras: 0,
  percent: 0,
  contributingHabits: 0,
  nothingDueYet: false,
  hasFutureToday: false,
  ...overrides,
});

const display = (r: BoardProgressResult, totalCount: number) => {
  const t = boardHeaderText(r, totalCount);
  return { header: `${t.percent}% ${t.suffix}`, subheader: t.line };
};

describe("boardHeader", () => {
  describe("empty board", () => {
    it("invites the user to set up their first habit", () => {
      expect(display(result({}), 0)).toEqual({
        header: "0% today",
        subheader: "set up your first habit.",
      });
    });
  });

  describe("habits with no goals", () => {
    it("shows nothing-to-track copy", () => {
      expect(display(result({}), 2)).toEqual({
        header: "0% today",
        subheader: "no goals set. nothing to track.",
      });
    });
  });

  describe("schedules ahead of now, none yet due", () => {
    it("shows nothing-due-yet copy", () => {
      expect(
        display(result({ nothingDueYet: true, hasFutureToday: true }), 1),
      ).toEqual({
        header: "0% so far",
        subheader: "nothing due yet.",
      });
    });

    it("acknowledges check-ins done before any slot was due", () => {
      expect(
        display(
          result({ nothingDueYet: true, hasFutureToday: true, extras: 2 }),
          1,
        ),
      ).toEqual({
        header: "0% so far",
        subheader: "2 done early. nothing due yet.",
      });
    });
  });

  describe("partial progress with more scheduled later today", () => {
    it("nothing done yet — nags", () => {
      expect(
        display(
          result({ expected: 2, done: 0, percent: 0, hasFutureToday: true }),
          1,
        ),
      ).toEqual({
        header: "0% so far",
        subheader: "0 of 2 due. tick tick tick.",
      });
    });

    it("some done, more remain", () => {
      expect(
        display(
          result({ expected: 3, done: 1, percent: 33, hasFutureToday: true }),
          1,
        ),
      ).toEqual({
        header: "33% so far",
        subheader: "1 of 3 done. 2 to go.",
      });
    });

    it("one to go uses singular copy", () => {
      expect(
        display(
          result({ expected: 2, done: 1, percent: 50, hasFutureToday: true }),
          1,
        ),
      ).toEqual({
        header: "50% so far",
        subheader: "1 of 2 done. one to go.",
      });
    });
  });

  describe("caught up but more is scheduled later today", () => {
    it("does not say 'all done' yet", () => {
      expect(
        display(
          result({ expected: 1, done: 1, percent: 100, hasFutureToday: true }),
          1,
        ),
      ).toEqual({
        header: "100% so far",
        subheader: "caught up. nice.",
      });
    });

    it("calls out extras done", () => {
      expect(
        display(
          result({
            expected: 1,
            done: 1,
            percent: 100,
            extras: 2,
            hasFutureToday: true,
          }),
          1,
        ),
      ).toEqual({
        header: "100% so far",
        subheader: "caught up. 2 extra done.",
      });
    });
  });

  describe("nothing more scheduled today", () => {
    it("says 'all done' when caught up", () => {
      expect(
        display(
          result({ expected: 2, done: 2, percent: 100, hasFutureToday: false }),
          1,
        ),
      ).toEqual({
        header: "100% today",
        subheader: "all done. nice.",
      });
    });

    it("daily-no-schedule habit short of goal", () => {
      expect(
        display(
          result({ expected: 3, done: 1, percent: 33, hasFutureToday: false }),
          1,
        ),
      ).toEqual({
        header: "33% today",
        subheader: "1 of 3 done. 2 to go.",
      });
    });
  });
});
