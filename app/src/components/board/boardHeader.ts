import type { BoardProgressResult } from "@nag/core";

export interface BoardHeaderText {
  /** Big number in the header. */
  percent: number;
  /** Suffix next to the number: "today" when nothing more is scheduled later, else "so far". */
  suffix: string;
  /** Subheader cheeky one-liner. */
  line: string;
}

/**
 * Pure mapping from a `boardProgress` result to the header + subheader text.
 */
export const boardHeaderText = (
  r: BoardProgressResult,
  totalCount: number,
): BoardHeaderText => ({
  percent: r.percent,
  suffix: r.hasFutureToday ? "so far" : "today",
  line: lineFor(r, totalCount),
});

const lineFor = (r: BoardProgressResult, totalCount: number): string => {
  if (totalCount === 0) return "set up your first habit.";
  if (r.nothingDueYet) {
    return r.extras > 0
      ? `${r.extras} done early. nothing due yet.`
      : "nothing due yet.";
  }
  if (r.expected === 0) return "no goals set. nothing to track.";
  if (r.done === 0) return `0 of ${r.expected} due. tick tick tick.`;
  if (r.done >= r.expected) {
    if (r.extras > 0) return `caught up. ${r.extras} extra done.`;
    return r.hasFutureToday ? "caught up. nice." : "all done. nice.";
  }
  const remaining = r.expected - r.done;
  if (remaining === 1) return `${r.done} of ${r.expected} done. one to go.`;
  return `${r.done} of ${r.expected} done. ${remaining} to go.`;
};
