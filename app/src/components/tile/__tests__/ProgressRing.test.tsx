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

  it("sets correct strokeDashoffset for 50% progress", () => {
    const { root } = render(
      <ProgressRing progress={0.5} size={size} strokeWidth={strokeWidth} />,
    );
    const circles = root.findAll(
      (node: { type: string }) => node.type === "RNSVGCircle",
    );
    const foreground = circles[1];
    expect(foreground.props.strokeDashoffset).toBeCloseTo(circumference * 0.5);
  });

  it("sets correct strokeDashoffset for 25% progress", () => {
    const { root } = render(
      <ProgressRing progress={0.25} size={size} strokeWidth={strokeWidth} />,
    );
    const circles = root.findAll(
      (node: { type: string }) => node.type === "RNSVGCircle",
    );
    const foreground = circles[1];
    expect(foreground.props.strokeDashoffset).toBeCloseTo(circumference * 0.75);
  });
});
