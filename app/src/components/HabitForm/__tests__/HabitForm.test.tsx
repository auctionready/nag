import { render, fireEvent, waitFor, act } from "@testing-library/react-native";
import { Alert } from "react-native";
import { HabitForm } from "../HabitForm";

jest.mock("../ScheduleEditorModal", () => {
  const { Pressable, View } = require("react-native");
  return {
    ScheduleEditorModal: ({ onCommit, onCancel }: any) => (
      <View testID="schedule-editor-modal">
        <Pressable
          testID="modal-apply"
          onPress={() =>
            onCommit({ hour: "10", minute: "30", days: 127, reminder: false })
          }
        />
        <Pressable testID="modal-cancel" onPress={onCancel} />
      </View>
    ),
  };
});

const onSubmit = jest.fn().mockResolvedValue(undefined);

beforeEach(() => {
  jest.clearAllMocks();
});

describe("rendering", () => {
  let utils: ReturnType<typeof render>;

  beforeEach(() => {
    utils = render(<HabitForm onSubmit={onSubmit} />);
  });

  it("renders title input and Save button", () => {
    expect(utils.getByPlaceholderText("e.g. Exercise")).toBeTruthy();
    expect(utils.getByText("Save")).toBeTruthy();
  });

  it("does not render Delete button without onDelete", () => {
    expect(utils.queryByText("Delete Habit")).toBeNull();
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

describe("validation", () => {
  it("shows title error and blocks submit when title is empty", async () => {
    const { getByText } = render(<HabitForm onSubmit={onSubmit} />);
    fireEvent.press(getByText("Save"));
    await waitFor(() => expect(getByText("Title is required")).toBeTruthy());
    expect(onSubmit).not.toHaveBeenCalled();
  });

  describe("frequency", () => {
    let utils: ReturnType<typeof render>;

    beforeEach(() => {
      utils = render(<HabitForm onSubmit={onSubmit} />);
      fireEvent.press(utils.getByText("Daily"));
      fireEvent.changeText(
        utils.getByPlaceholderText("e.g. Exercise"),
        "Exercise",
      );
    });

    it.each([["0"], ["abc"], ["1.5"]])(
      "blocks submit for '%s'",
      async (value) => {
        fireEvent.changeText(utils.getByPlaceholderText("1"), value);
        fireEvent.press(utils.getByText("Save"));
        await waitFor(() => expect(onSubmit).not.toHaveBeenCalled());
      },
    );

    it("submits when frequency is a valid integer", async () => {
      fireEvent.changeText(utils.getByPlaceholderText("1"), "3");
      fireEvent.press(utils.getByText("Save"));
      await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    });
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

  it("does not prompt when switching to Scheduled", () => {
    jest.spyOn(Alert, "alert");
    const { getByText } = render(<HabitForm onSubmit={onSubmit} />);
    fireEvent.press(getByText("Scheduled"));
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  describe("switching away from Scheduled with entries", () => {
    let utils: ReturnType<typeof render>;

    beforeEach(() => {
      jest.spyOn(Alert, "alert");
      utils = render(
        <HabitForm
          onSubmit={onSubmit}
          initialValues={{
            regularity: "scheduled",
            schedules: [{ hour: "9", minute: "00" }],
          }}
        />,
      );
      fireEvent.press(utils.getByText("Daily"));
    });

    it("prompts with a confirmation alert", () => {
      expect(Alert.alert).toHaveBeenCalledWith(
        "Clear Schedules",
        expect.any(String),
        expect.any(Array),
      );
    });

    it("keeps Scheduled when cancel is chosen", () => {
      // Cancel button has no onPress — state unchanged
      expect(utils.getByText("+ Add Time")).toBeTruthy();
    });

    it("switches to Daily when continue is chosen", async () => {
      const buttons = (Alert.alert as jest.Mock).mock.calls[0][2];
      await act(async () => {
        buttons.find((b: any) => b.text === "Continue").onPress();
      });
      expect(utils.getByText("per day")).toBeTruthy();
    });
  });
});

describe("schedule editor", () => {
  let utils: ReturnType<typeof render>;

  beforeEach(() => {
    utils = render(<HabitForm onSubmit={onSubmit} />);
    fireEvent.press(utils.getByText("Scheduled"));
    fireEvent.press(utils.getByText("+ Add Time"));
  });

  it("opens the modal", () => {
    expect(utils.getByTestId("schedule-editor-modal")).toBeTruthy();
  });

  it("closes when cancel is pressed", async () => {
    fireEvent.press(utils.getByTestId("modal-cancel"));
    await waitFor(() =>
      expect(utils.queryByTestId("schedule-editor-modal")).toBeNull(),
    );
  });

  it("closes when apply is pressed", async () => {
    fireEvent.press(utils.getByTestId("modal-apply"));
    await waitFor(() =>
      expect(utils.queryByTestId("schedule-editor-modal")).toBeNull(),
    );
  });
});
