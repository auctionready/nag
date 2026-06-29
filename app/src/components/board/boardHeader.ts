import type { BoardProgressResult } from "@nag/core";

export interface BoardHeaderText {
  /** Big number in the header. */
  percent: number;
  /** Suffix next to the number. Always "today" — the metric is a whole-day count. */
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
  suffix: "today",
  line: lineFor(r, totalCount),
});

const lineFor = (r: BoardProgressResult, totalCount: number): string => {
  if (totalCount === 0) return "set up your first habit.";
  if (r.nothingDue) {
    return r.extras > 0
      ? `${r.extras} done. nothing else due today.`
      : "nothing due today.";
  }
  if (r.expected === 0) return "no goals set. nothing to track.";
  if (r.done === 0) return `0 of ${r.expected} due.`;
  if (r.done >= r.expected) {
    if (r.extras > 0) return `all done. ${r.extras} extra done.`;
    if (r.doneEarly > 0) {
      // Every check-in was ahead of its slot → "all done early"; otherwise
      // some were on time, so just count the early ones.
      return r.doneEarly >= r.done
        ? "all done early. nice."
        : `all done. ${r.doneEarly} early.`;
    }
    return "all done. nice.";
  }
  const remaining = r.expected - r.done;
  const early = r.doneEarly > 0 ? ` (${r.doneEarly} early)` : "";
  if (remaining === 1)
    return `${r.done} of ${r.expected} done${early}. one to go.`;
  return `${r.done} of ${r.expected} done${early}. ${remaining} to go.`;
};
