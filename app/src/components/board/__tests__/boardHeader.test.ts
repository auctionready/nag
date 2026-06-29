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
  nothingDue: false,
  doneEarly: 0,
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

  describe("nothing scheduled for today", () => {
    it("shows nothing-due copy", () => {
      expect(display(result({ nothingDue: true }), 1)).toEqual({
        header: "0% today",
        subheader: "nothing due today.",
      });
    });

    it("acknowledges check-ins on a habit not due today", () => {
      expect(display(result({ nothingDue: true, extras: 2 }), 1)).toEqual({
        header: "0% today",
        subheader: "2 done. nothing else due today.",
      });
    });
  });

  describe("partial progress", () => {
    it("nothing done yet", () => {
      expect(display(result({ expected: 2, done: 0, percent: 0 }), 1)).toEqual({
        header: "0% today",
        subheader: "0 of 2 due.",
      });
    });

    it("some done, more remain", () => {
      expect(display(result({ expected: 3, done: 1, percent: 33 }), 1)).toEqual(
        {
          header: "33% today",
          subheader: "1 of 3 done. 2 to go.",
        },
      );
    });

    it("one to go uses singular copy", () => {
      expect(display(result({ expected: 2, done: 1, percent: 50 }), 1)).toEqual(
        {
          header: "50% today",
          subheader: "1 of 2 done. one to go.",
        },
      );
    });

    it("notes early check-ins while still short of the goal", () => {
      expect(
        display(result({ expected: 3, done: 1, percent: 33, doneEarly: 1 }), 1),
      ).toEqual({
        header: "33% today",
        subheader: "1 of 3 done (1 early). 2 to go.",
      });
    });
  });

  describe("all done", () => {
    it("says 'all done' when caught up", () => {
      expect(
        display(result({ expected: 2, done: 2, percent: 100 }), 1),
      ).toEqual({
        header: "100% today",
        subheader: "all done. nice.",
      });
    });

    it("calls out extras done", () => {
      expect(
        display(result({ expected: 1, done: 1, percent: 100, extras: 2 }), 1),
      ).toEqual({
        header: "100% today",
        subheader: "all done. 2 extra done.",
      });
    });

    it("says 'all done early' when every check-in was ahead of its slot", () => {
      expect(
        display(
          result({ expected: 1, done: 1, percent: 100, doneEarly: 1 }),
          1,
        ),
      ).toEqual({
        header: "100% today",
        subheader: "all done early. nice.",
      });
    });

    it("counts the early ones when only some were ahead", () => {
      expect(
        display(
          result({ expected: 2, done: 2, percent: 100, doneEarly: 1 }),
          1,
        ),
      ).toEqual({
        header: "100% today",
        subheader: "all done. 1 early.",
      });
    });
  });
});
