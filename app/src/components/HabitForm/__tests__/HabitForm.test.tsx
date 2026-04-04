import { render, fireEvent, waitFor } from "@testing-library/react-native";
import { Alert } from "react-native";
import { HabitForm } from "../HabitForm";

jest.mock("../ScheduleEditorModal", () => ({
  ScheduleEditorModal: () => null,
}));

const onSubmit = jest.fn().mockResolvedValue(undefined);

beforeEach(() => {
  jest.clearAllMocks();
});

describe("rendering", () => {
  it("renders title input with placeholder", () => {
    const { getByPlaceholderText } = render(<HabitForm onSubmit={onSubmit} />);
    expect(getByPlaceholderText("e.g. Exercise")).toBeTruthy();
  });

  it("renders Save button", () => {
    const { getByText } = render(<HabitForm onSubmit={onSubmit} />);
    expect(getByText("Save")).toBeTruthy();
  });

  it("does not render Delete button when onDelete is not provided", () => {
    const { queryByText } = render(<HabitForm onSubmit={onSubmit} />);
    expect(queryByText("Delete Habit")).toBeNull();
  });

  it("renders Delete button when onDelete is provided", () => {
    const { getByText } = render(
      <HabitForm onSubmit={onSubmit} onDelete={() => {}} />,
    );
    expect(getByText("Delete Habit")).toBeTruthy();
  });

  it("pre-fills title from initialValues", () => {
    const { getByDisplayValue } = render(
      <HabitForm onSubmit={onSubmit} initialValues={{ title: "Exercise" }} />,
    );
    expect(getByDisplayValue("Exercise")).toBeTruthy();
  });
});

describe("validation", () => {
  it("shows title error when saved with empty title", async () => {
    const { getByText } = render(<HabitForm onSubmit={onSubmit} />);
    fireEvent.press(getByText("Save"));
    await waitFor(() => expect(getByText("Title is required")).toBeTruthy());
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe("submission", () => {
  it("calls onSubmit with form data when title is provided", async () => {
    const { getByPlaceholderText, getByText } = render(
      <HabitForm onSubmit={onSubmit} />,
    );
    fireEvent.changeText(getByPlaceholderText("e.g. Exercise"), "Meditation");
    fireEvent.press(getByText("Save"));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ title: "Meditation" });
  });
});

describe("regularity", () => {
  it("shows frequency input when Daily is selected", () => {
    const { getByText, getByPlaceholderText } = render(
      <HabitForm onSubmit={onSubmit} />,
    );
    fireEvent.press(getByText("Daily"));
    expect(getByPlaceholderText("1")).toBeTruthy();
    expect(getByText("per day")).toBeTruthy();
  });

  it("hides frequency input for Ad-hoc", () => {
    const { queryByPlaceholderText } = render(
      <HabitForm onSubmit={onSubmit} />,
    );
    expect(queryByPlaceholderText("1")).toBeNull();
  });

  it("shows Add Time button when Scheduled is selected", () => {
    const { getByText } = render(<HabitForm onSubmit={onSubmit} />);
    fireEvent.press(getByText("Scheduled"));
    expect(getByText("+ Add Time")).toBeTruthy();
  });

  it("prompts confirmation when switching away from Scheduled with entries", async () => {
    jest.spyOn(Alert, "alert");
    const { getByText } = render(
      <HabitForm
        onSubmit={onSubmit}
        initialValues={{
          regularity: "scheduled",
          schedules: [{ hour: "9", minute: "00" }],
        }}
      />,
    );
    fireEvent.press(getByText("Daily"));
    expect(Alert.alert).toHaveBeenCalledWith(
      "Clear Schedules",
      expect.any(String),
      expect.any(Array),
    );
  });
});
