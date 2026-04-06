import { render } from "@testing-library/react-native";
import { Day } from "@nag/core";
import { DayIndicators } from "../DayIndicators";

describe("DayIndicators", () => {
  const scheduledColor = "#34C759";

  it("renders 7 day letters", () => {
    const { getAllByText } = render(
      <DayIndicators
        scheduledDaysMask={Day.Mon | Day.Wed | Day.Fri}
        scheduledDayColor={scheduledColor}
      />,
    );
    // M T W T F S S = 7 letters (some share same letter)
    const letters = ["M", "T", "W", "F", "S"];
    for (const letter of letters) {
      expect(getAllByText(letter).length).toBeGreaterThanOrEqual(1);
    }
  });

  it("applies scheduled color to scheduled days", () => {
    const { UNSAFE_root } = render(
      <DayIndicators
        scheduledDaysMask={Day.Mon}
        scheduledDayColor={scheduledColor}
      />,
    );
    const indicators = UNSAFE_root.findAll(
      (node: {
        type: string;
        props: { style?: { backgroundColor?: string }[] };
      }) =>
        node.type === "View" &&
        node.props.style?.some?.((s) => s.backgroundColor === scheduledColor),
    );
    expect(indicators.length).toBe(1);
  });

  it("applies muted color to unscheduled days", () => {
    const { UNSAFE_root } = render(
      <DayIndicators
        scheduledDaysMask={Day.Mon}
        scheduledDayColor={scheduledColor}
      />,
    );
    const indicators = UNSAFE_root.findAll(
      (node: {
        type: string;
        props: { style?: { backgroundColor?: string }[] };
      }) =>
        node.type === "View" &&
        node.props.style?.some?.(
          (s) => s.backgroundColor === "rgba(255, 255, 255, 0.2)",
        ),
    );
    expect(indicators.length).toBe(6);
  });
});
