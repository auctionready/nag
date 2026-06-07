import { render } from "@testing-library/react-native";
import { StatusNote } from "../StatusNote";

describe("StatusNote", () => {
  // Only paused habits reach the editor — archived ones are read-only and
  // redirect away — so the note renders for `paused` only.
  it("renders nothing for an active habit", async () => {
    const view = await render(<StatusNote status="active" />);
    expect(view.toJSON()).toBeNull();
  });

  it("renders nothing for an archived habit", async () => {
    const view = await render(<StatusNote status="archived" />);
    expect(view.toJSON()).toBeNull();
  });

  it("shows the paused note", async () => {
    const view = await render(<StatusNote status="paused" />);
    expect(
      view.getByText("paused — nags are off, still on your board"),
    ).toBeTruthy();
  });
});
