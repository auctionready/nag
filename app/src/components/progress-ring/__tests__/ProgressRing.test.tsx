import { render } from "@testing-library/react-native";
import { ProgressRing } from "../ProgressRing";

describe("ProgressRing", () => {
  const size = 36;
  const strokeWidth = 4;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  it("renders without crashing", () => {
    render(<ProgressRing progress={0.5} />);
  });

  it("compensates for round linecaps at 50% progress", () => {
    const { root } = render(
      <ProgressRing progress={0.5} size={size} strokeWidth={strokeWidth} />,
    );
    const circles = root.findAll(
      (node: { type: string }) => node.type === "RNSVGCircle",
    );
    const foreground = circles[1];
    // rawOffset + strokeWidth to cancel the visual extension from round caps
    expect(foreground.props.strokeDashoffset).toBeCloseTo(
      circumference * 0.5 + strokeWidth,
    );
  });

  it("compensates for round linecaps at 25% progress", () => {
    const { root } = render(
      <ProgressRing progress={0.25} size={size} strokeWidth={strokeWidth} />,
    );
    const circles = root.findAll(
      (node: { type: string }) => node.type === "RNSVGCircle",
    );
    const foreground = circles[1];
    expect(foreground.props.strokeDashoffset).toBeCloseTo(
      circumference * 0.75 + strokeWidth,
    );
  });

  it("skips linecap compensation at 0% and 100%", () => {
    const { root: full } = render(
      <ProgressRing progress={1} size={size} strokeWidth={strokeWidth} />,
    );
    const fullCircles = full.findAll(
      (node: { type: string }) => node.type === "RNSVGCircle",
    );
    // offset=0 may be null (react-native-svg drops falsy values)
    const fullOffset = fullCircles[1].props.strokeDashoffset ?? 0;
    expect(fullOffset).toBeCloseTo(0);

    const { root: empty } = render(
      <ProgressRing progress={0} size={size} strokeWidth={strokeWidth} />,
    );
    const emptyCircles = empty.findAll(
      (node: { type: string }) => node.type === "RNSVGCircle",
    );
    expect(emptyCircles[1].props.strokeDashoffset).toBeCloseTo(circumference);
  });
});
