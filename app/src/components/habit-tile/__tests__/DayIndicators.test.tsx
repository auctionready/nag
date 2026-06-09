import { Day } from "@nag/core";
import { DayIndicators, buildCells } from "../DayIndicators";
import { renderWithToday } from "../../../test-utils/renderWithToday";

const monday = new Date(2025, 5, 16); // 2025-06-16 is a Monday

// Monday-first order, so index 2 is Wednesday (not "today" given `monday`).
const WED_INDEX = 2;

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe("DayIndicators", () => {
  it("renders 7 day letters in Monday-first order", async () => {
    const { getAllByText } = await renderWithToday(
      <DayIndicators
        scheduledDaysMask={Day.Mon | Day.Wed | Day.Fri}
        checkedInDaysMask={0}
      />,
      { now: monday },
    );
    // M appears once, T appears twice, W once, F once, S appears twice
    expect(getAllByText("M")).toHaveLength(1);
    expect(getAllByText("T")).toHaveLength(2);
    expect(getAllByText("W")).toHaveLength(1);
    expect(getAllByText("F")).toHaveLength(1);
    expect(getAllByText("S")).toHaveLength(2);
  });

  it("renders without crashing with all days scheduled and checked in", async () => {
    await renderWithToday(
      <DayIndicators scheduledDaysMask={127} checkedInDaysMask={127} />,
      { now: monday },
    );
  });

  it("renders without crashing with no check-ins", async () => {
    await renderWithToday(
      <DayIndicators
        scheduledDaysMask={Day.Mon | Day.Wed}
        checkedInDaysMask={0}
      />,
      { now: monday },
    );
  });

  // Unscheduled-weekly goals pass the same mask for both `scheduledDaysMask`
  // and `checkedInDaysMask` (the days the user actually checked in on) with
  // no `todayColor`/`partialColor`/`missedColor`. Should render without
  // crashing; `buildDayCells` tests cover the resulting green fills.
  it("renders the unscheduled-weekly shape without crashing", async () => {
    await renderWithToday(
      <DayIndicators
        scheduledDaysMask={Day.Mon | Day.Wed}
        checkedInDaysMask={Day.Mon | Day.Wed}
      />,
      { now: monday },
    );
  });

  describe("buildCells skip vs partial precedence", () => {
    // A multi-slot day where one of the slots is a skip and the rest are still
    // open lands in *both* partialDaysMask and skippedDaysMask. It should
    // part-fill (same as checking one slot in), not render a full skip.
    it("renders a partially-attended day with a skip as partial", () => {
      const cells = buildCells({
        scheduledDaysMask: Day.Wed,
        checkedInDaysMask: 0,
        partialDaysMask: Day.Wed,
        skippedDaysMask: Day.Wed,
        now: monday,
      });
      expect(cells[WED_INDEX].state).toBe("partial");
    });

    // A day where every scheduled slot is accounted for by skips (no open
    // slots, so not partial) is genuinely set aside and stays a full skip.
    it("renders a fully-skipped day as skipped", () => {
      const cells = buildCells({
        scheduledDaysMask: Day.Wed,
        checkedInDaysMask: Day.Wed,
        partialDaysMask: 0,
        skippedDaysMask: Day.Wed,
        now: monday,
      });
      expect(cells[WED_INDEX].state).toBe("skipped");
    });
  });
});
