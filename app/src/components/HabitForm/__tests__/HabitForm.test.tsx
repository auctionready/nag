import { render, fireEvent, waitFor, act } from "@testing-library/react-native";
import { Alert } from "react-native";
import { HabitForm } from "../HabitForm";

jest.mock("../ScheduleEditorModal", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
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

// Flush all pending microtasks and macrotasks so react-hook-form's async
// handleSubmit chain fully completes before act() exits.
const flush = () => new Promise<void>((resolve) => setImmediate(resolve));

beforeEach(() => {
  jest.clearAllMocks();
});

describe("rendering", () => {
  let view: ReturnType<typeof render>;

  beforeEach(async () => {
    view = render(<HabitForm onSubmit={onSubmit} />);
    await act(async () => {});
  });

  it("renders title input and Save button", () => {
    expect(view.getByPlaceholderText("e.g. Exercise")).toBeTruthy();
    expect(view.getByText("Save")).toBeTruthy();
  });

  it("does not render Delete button without onDelete", () => {
    expect(view.queryByText("Delete Habit")).toBeNull();
  });

  it("renders Delete button when onDelete is provided", () => {
    const { getByText } = render(
      <HabitForm onSubmit={onSubmit} onDelete={() => {}} />,
    );
    expect(getByText("Delete Habit")).toBeTruthy();
  });

  it("pre-fills title from initialValues", async () => {
    const { getByDisplayValue } = render(
      <HabitForm onSubmit={onSubmit} initialValues={{ title: "Exercise" }} />,
    );
    await act(async () => {
      await flush();
    });
    expect(getByDisplayValue("Exercise")).toBeTruthy();
  });
});

describe("submission", () => {
  it("calls onSubmit with form data when title is provided", async () => {
    const { getByPlaceholderText, getByText } = render(
      <HabitForm onSubmit={onSubmit} />,
    );
    await act(async () => {
      fireEvent.changeText(getByPlaceholderText("e.g. Exercise"), "Meditation");
      await flush();
    });
    await act(async () => {
      fireEvent.press(getByText("Save"));
      await flush();
    });
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ title: "Meditation" });
  });
});

describe("validation", () => {
  it("shows title error and blocks submit when title is cleared", async () => {
    const { getByPlaceholderText, getByText } = render(
      <HabitForm onSubmit={onSubmit} />,
    );
    // Trigger onChange validation by typing then clearing
    await act(async () => {
      fireEvent.changeText(getByPlaceholderText("e.g. Exercise"), "x");
      await flush();
    });
    await act(async () => {
      fireEvent.changeText(getByPlaceholderText("e.g. Exercise"), "");
      await flush();
    });
    await waitFor(() => expect(getByText("Title is required")).toBeTruthy());
    await act(async () => {
      fireEvent.press(getByText("Save"));
      await flush();
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  describe("frequency", () => {
    let view: ReturnType<typeof render>;

    beforeEach(async () => {
      view = render(<HabitForm onSubmit={onSubmit} />);
      await act(async () => {
        fireEvent.press(view.getByText("Daily"));
      });
      await act(async () => {
        fireEvent.changeText(
          view.getByPlaceholderText("e.g. Exercise"),
          "Exercise",
        );
        await flush();
      });
    });

    it.each([["0"], ["abc"], ["1.5"]])(
      "blocks submit for '%s'",
      async (value) => {
        await act(async () => {
          fireEvent.changeText(view.getByPlaceholderText("1"), value);
          fireEvent.press(view.getByText("Save"));
          await flush();
        });
        await waitFor(() => expect(onSubmit).not.toHaveBeenCalled());
      },
    );

    it("submits when frequency is a valid integer", async () => {
      await act(async () => {
        fireEvent.changeText(view.getByPlaceholderText("1"), "3");
        fireEvent.press(view.getByText("Save"));
        await flush();
      });
      await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    });
  });
});

describe("regularity", () => {
  it("shows frequency input when Daily is selected", async () => {
    const { getByText, getByPlaceholderText } = render(
      <HabitForm onSubmit={onSubmit} />,
    );
    await act(async () => {
      fireEvent.press(getByText("Daily"));
    });
    expect(getByPlaceholderText("1")).toBeTruthy();
    expect(getByText("per day")).toBeTruthy();
  });

  it("hides frequency input for Ad-hoc", () => {
    const { queryByPlaceholderText } = render(
      <HabitForm onSubmit={onSubmit} />,
    );
    expect(queryByPlaceholderText("1")).toBeNull();
  });

  it("shows Add Time button when Scheduled is selected", async () => {
    const { getByText } = render(<HabitForm onSubmit={onSubmit} />);
    await act(async () => {
      fireEvent.press(getByText("Scheduled"));
    });
    expect(getByText("+ Add Time")).toBeTruthy();
  });

  it("does not prompt when switching to Scheduled", async () => {
    jest.spyOn(Alert, "alert");
    const { getByText } = render(<HabitForm onSubmit={onSubmit} />);
    await act(async () => {
      fireEvent.press(getByText("Scheduled"));
    });
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  describe("switching away from Scheduled with entries", () => {
    let view: ReturnType<typeof render>;

    beforeEach(async () => {
      jest.spyOn(Alert, "alert");
      view = render(
        <HabitForm
          onSubmit={onSubmit}
          initialValues={{
            regularity: "scheduled",
            schedules: [{ hour: "9", minute: "00" }],
          }}
        />,
      );
      await act(async () => {
        fireEvent.press(view.getByText("Daily"));
      });
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
      expect(view.getByText("+ Add Time")).toBeTruthy();
    });

    it("switches to Daily when continue is chosen", async () => {
      const buttons = (Alert.alert as jest.Mock).mock.calls[0][2];
      await act(async () => {
        buttons.find((b: any) => b.text === "Continue").onPress();
      });
      expect(view.getByText("per day")).toBeTruthy();
    });
  });
});

describe("description", () => {
  describe("without initial values", () => {
    let view: ReturnType<typeof render>;

    beforeEach(async () => {
      view = render(<HabitForm onSubmit={onSubmit} />);
      await act(async () => {});
    });

    it("renders description input", () => {
      expect(view.getByPlaceholderText("Describe the habit")).toBeTruthy();
    });

    it("includes description in submitted data", async () => {
      await act(async () => {
        fireEvent.changeText(view.getByPlaceholderText("e.g. Exercise"), "Run");
        await flush();
      });
      await act(async () => {
        fireEvent.changeText(
          view.getByPlaceholderText("Describe the habit"),
          "Go for a run",
        );
        await flush();
      });
      await act(async () => {
        fireEvent.press(view.getByText("Save"));
        await flush();
      });
      expect(onSubmit).toHaveBeenCalledTimes(1);
      expect(onSubmit.mock.calls[0][0]).toMatchObject({
        title: "Run",
        description: "Go for a run",
      });
    });
  });

  describe("with initial description", () => {
    it("pre-fills from initialValues", async () => {
      const { getByDisplayValue } = render(
        <HabitForm
          onSubmit={onSubmit}
          initialValues={{ title: "Test", description: "My description" }}
        />,
      );
      await act(async () => {
        await flush();
      });
      expect(getByDisplayValue("My description")).toBeTruthy();
    });
  });
});

describe("delete", () => {
  const onDelete = jest.fn();
  let view: ReturnType<typeof render>;

  beforeEach(async () => {
    onDelete.mockClear();
    jest.spyOn(Alert, "alert");
    view = render(<HabitForm onSubmit={onSubmit} onDelete={onDelete} />);
    await act(async () => {
      fireEvent.press(view.getByText("Delete Habit"));
    });
  });

  it("shows confirmation alert", () => {
    expect(Alert.alert).toHaveBeenCalledWith(
      "Delete Habit",
      expect.any(String),
      expect.any(Array),
    );
  });

  it("does not call onDelete before confirmation", () => {
    expect(onDelete).not.toHaveBeenCalled();
  });

  it("calls onDelete when confirmed", async () => {
    const buttons = (Alert.alert as jest.Mock).mock.calls[0][2];
    await act(async () => {
      buttons.find((b: any) => b.text === "Delete").onPress();
    });
    expect(onDelete).toHaveBeenCalledTimes(1);
  });
});

describe("schedule editor", () => {
  let view: ReturnType<typeof render>;

  beforeEach(async () => {
    view = render(<HabitForm onSubmit={onSubmit} />);
    await act(async () => {
      fireEvent.press(view.getByText("Scheduled"));
    });
    await act(async () => {
      fireEvent.press(view.getByText("+ Add Time"));
    });
  });

  it("opens the modal", () => {
    expect(view.getByTestId("schedule-editor-modal")).toBeTruthy();
  });

  it("closes when cancel is pressed", async () => {
    await act(async () => {
      fireEvent.press(view.getByTestId("modal-cancel"));
    });
    await waitFor(() =>
      expect(view.queryByTestId("schedule-editor-modal")).toBeNull(),
    );
  });

  it("closes when apply is pressed", async () => {
    await act(async () => {
      fireEvent.press(view.getByTestId("modal-apply"));
    });
    await waitFor(() =>
      expect(view.queryByTestId("schedule-editor-modal")).toBeNull(),
    );
  });
});
