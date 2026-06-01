import { render, fireEvent } from "@testing-library/react-native";
import { StatusBanner } from "../StatusBanner";

describe("StatusBanner", () => {
  it("renders nothing for an active habit", () => {
    const view = render(
      <StatusBanner
        status="active"
        onResume={jest.fn()}
        onUnarchive={jest.fn()}
      />,
    );
    expect(view.queryByText("paused")).toBeNull();
    expect(view.queryByText("archived")).toBeNull();
  });

  it("shows the paused state and resumes", () => {
    const onResume = jest.fn();
    const view = render(
      <StatusBanner
        status="paused"
        onResume={onResume}
        onUnarchive={jest.fn()}
      />,
    );
    expect(view.getByText("paused")).toBeTruthy();
    fireEvent.press(view.getByLabelText("Resume"));
    expect(onResume).toHaveBeenCalledTimes(1);
  });

  it("shows the archived state and unarchives", () => {
    const onUnarchive = jest.fn();
    const view = render(
      <StatusBanner
        status="archived"
        onResume={jest.fn()}
        onUnarchive={onUnarchive}
      />,
    );
    expect(view.getByText("archived")).toBeTruthy();
    fireEvent.press(view.getByLabelText("Unarchive"));
    expect(onUnarchive).toHaveBeenCalledTimes(1);
  });
});
