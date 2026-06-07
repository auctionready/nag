import { render, fireEvent } from "@testing-library/react-native";
import { StatusBanner } from "../StatusBanner";

describe("StatusBanner", () => {
  it("renders nothing for an active habit", async () => {
    const view = await render(
      <StatusBanner
        status="active"
        onResume={jest.fn()}
        onUnarchive={jest.fn()}
      />,
    );
    expect(view.queryByText("paused")).toBeNull();
    expect(view.queryByText("archived")).toBeNull();
  });

  it("shows the paused state and resumes", async () => {
    const onResume = jest.fn();
    const view = await render(
      <StatusBanner
        status="paused"
        onResume={onResume}
        onUnarchive={jest.fn()}
      />,
    );
    expect(view.getByText("paused")).toBeTruthy();
    await fireEvent.press(view.getByLabelText("Resume"));
    expect(onResume).toHaveBeenCalledTimes(1);
  });

  it("shows the archived state and unarchives", async () => {
    const onUnarchive = jest.fn();
    const view = await render(
      <StatusBanner
        status="archived"
        onResume={jest.fn()}
        onUnarchive={onUnarchive}
      />,
    );
    expect(view.getByText("archived")).toBeTruthy();
    await fireEvent.press(view.getByLabelText("Unarchive"));
    expect(onUnarchive).toHaveBeenCalledTimes(1);
  });
});
