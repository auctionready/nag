import { render } from "@testing-library/react-native";
import { StatusNote } from "../StatusNote";

describe("StatusNote", () => {
  it("renders nothing for an active habit", () => {
    const view = render(<StatusNote status="active" />);
    expect(view.toJSON()).toBeNull();
  });

  it("shows the paused note", () => {
    const view = render(<StatusNote status="paused" />);
    expect(
      view.getByText("paused — nags are off, still on your board"),
    ).toBeTruthy();
  });

  it("shows the archived note", () => {
    const view = render(<StatusNote status="archived" />);
    expect(view.getByText("archived — hidden from your board")).toBeTruthy();
  });
});
