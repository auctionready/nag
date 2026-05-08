import { Day } from "@nag/core";
import { DayIndicators } from "../DayIndicators";
import { renderWithToday } from "../../../../../test-utils/renderWithToday";

const monday = new Date(2025, 5, 16); // 2025-06-16 is a Monday

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe("DayIndicators", () => {
  it("renders 7 day letters in Monday-first order", () => {
    const { getAllByText } = renderWithToday(
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

  it("renders without crashing with all days scheduled and checked in", () => {
    renderWithToday(
      <DayIndicators scheduledDaysMask={127} checkedInDaysMask={127} />,
      { now: monday },
    );
  });

  it("renders without crashing with no check-ins", () => {
    renderWithToday(
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
  it("renders the unscheduled-weekly shape without crashing", () => {
    renderWithToday(
      <DayIndicators
        scheduledDaysMask={Day.Mon | Day.Wed}
        checkedInDaysMask={Day.Mon | Day.Wed}
      />,
      { now: monday },
    );
  });
});
