import { Day } from "@nag/core";
import { stateFor } from "../DetailWeekStrip";

// 2025-06-16 is a Monday; pick a Wednesday so the cell is neither today nor
// in the future relative to the strip's "today".
const todayStart = new Date(2025, 5, 16);
const wednesday = new Date(2025, 5, 18);

describe("DetailWeekStrip stateFor skip vs partial precedence", () => {
  const base = {
    day: Day.Wed,
    cellDate: wednesday,
    todayStart,
    scheduledDaysMask: Day.Wed,
    anyCheckInDaysMask: 0,
  };

  // A multi-slot day with one skip and one still-open slot is in both
  // partialDaysMask and skippedDaysMask. It should read as partial, matching
  // the home-tile DayIndicators behaviour, not as a full skip.
  it("renders a partially-attended day with a skip as partial", () => {
    const state = stateFor({
      ...base,
      checkedInDaysMask: 0,
      partialDaysMask: Day.Wed,
      skippedDaysMask: Day.Wed,
    });
    expect(state).toBe("partial");
  });

  // Every scheduled slot accounted for by skips (not partial) stays a skip.
  it("renders a fully-skipped day as skipped", () => {
    const state = stateFor({
      ...base,
      checkedInDaysMask: Day.Wed,
      partialDaysMask: 0,
      skippedDaysMask: Day.Wed,
    });
    expect(state).toBe("skipped");
  });
});
