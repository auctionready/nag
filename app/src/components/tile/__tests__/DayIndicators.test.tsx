import { render } from "@testing-library/react-native";
import { Day } from "@nag/core";
import { DayIndicators } from "../DayIndicators";

describe("DayIndicators", () => {
  it("renders 7 day letters in Monday-first order", () => {
    const { getAllByText } = render(
      <DayIndicators
        scheduledDaysMask={Day.Mon | Day.Wed | Day.Fri}
        checkedInDaysMask={0}
      />,
    );
    // M appears once, T appears twice, W once, F once, S appears twice
    expect(getAllByText("M")).toHaveLength(1);
    expect(getAllByText("T")).toHaveLength(2);
    expect(getAllByText("W")).toHaveLength(1);
    expect(getAllByText("F")).toHaveLength(1);
    expect(getAllByText("S")).toHaveLength(2);
  });

  it("renders without crashing with all days scheduled and checked in", () => {
    render(<DayIndicators scheduledDaysMask={127} checkedInDaysMask={127} />);
  });

  it("renders without crashing with no check-ins", () => {
    render(
      <DayIndicators
        scheduledDaysMask={Day.Mon | Day.Wed}
        checkedInDaysMask={0}
      />,
    );
  });
});
