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

  it("renders title input and primary action", () => {
    expect(view.getByPlaceholderText("morning run")).toBeTruthy();
    expect(view.getByText("start nagging me")).toBeTruthy();
  });

  it("renders 'save changes' label in edit mode", () => {
    const { getByText } = render(<HabitForm onSubmit={onSubmit} mode="edit" />);
    expect(getByText("save changes")).toBeTruthy();
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
      fireEvent.changeText(getByPlaceholderText("morning run"), "Meditation");
      await flush();
    });
    await act(async () => {
      fireEvent.press(getByText("start nagging me"));
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
      fireEvent.changeText(getByPlaceholderText("morning run"), "x");
      await flush();
    });
    await act(async () => {
      fireEvent.changeText(getByPlaceholderText("morning run"), "");
      await flush();
    });
    await waitFor(() => expect(getByText("Title is required")).toBeTruthy());
    await act(async () => {
      fireEvent.press(getByText("start nagging me"));
      await flush();
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  describe("frequency", () => {
    let view: ReturnType<typeof render>;

    beforeEach(async () => {
      view = render(<HabitForm onSubmit={onSubmit} />);
      await act(async () => {
        fireEvent.press(view.getByText("daily"));
      });
      await act(async () => {
        fireEvent.changeText(
          view.getByPlaceholderText("morning run"),
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
          fireEvent.press(view.getByText("start nagging me"));
          await flush();
        });
        await waitFor(() => expect(onSubmit).not.toHaveBeenCalled());
      },
    );

    it("submits when frequency is a valid integer", async () => {
      await act(async () => {
        fireEvent.changeText(view.getByPlaceholderText("1"), "3");
        fireEvent.press(view.getByText("start nagging me"));
        await flush();
      });
      await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    });
  });
});

describe("regularity", () => {
  it("shows frequency input when daily is selected", async () => {
    const { getByText, getByPlaceholderText } = render(
      <HabitForm onSubmit={onSubmit} />,
    );
    await act(async () => {
      fireEvent.press(getByText("daily"));
    });
    expect(getByPlaceholderText("1")).toBeTruthy();
    expect(getByText("times per day")).toBeTruthy();
  });

  it("hides frequency input for ad-hoc", () => {
    const { queryByPlaceholderText } = render(
      <HabitForm onSubmit={onSubmit} />,
    );
    expect(queryByPlaceholderText("1")).toBeNull();
  });

  it("shows add time button when scheduled is selected", async () => {
    const { getByText } = render(<HabitForm onSubmit={onSubmit} />);
    await act(async () => {
      fireEvent.press(getByText("scheduled"));
    });
    expect(getByText("add time")).toBeTruthy();
  });

  it("does not prompt when switching to scheduled", async () => {
    jest.spyOn(Alert, "alert");
    const { getByText } = render(<HabitForm onSubmit={onSubmit} />);
    await act(async () => {
      fireEvent.press(getByText("scheduled"));
    });
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  describe("switching away from scheduled with entries", () => {
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
        fireEvent.press(view.getByText("daily"));
      });
    });

    it("prompts with a confirmation alert", () => {
      expect(Alert.alert).toHaveBeenCalledWith(
        "Clear Schedules",
        expect.any(String),
        expect.any(Array),
      );
    });

    it("keeps scheduled when cancel is chosen", () => {
      // Cancel button has no onPress — state unchanged
      expect(view.getByText("add time")).toBeTruthy();
    });

    it("switches to daily when continue is chosen", async () => {
      const buttons = (Alert.alert as jest.Mock).mock.calls[0][2];
      await act(async () => {
        buttons.find((b: any) => b.text === "Continue").onPress();
      });
      expect(view.getByText("times per day")).toBeTruthy();
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
      expect(
        view.getByPlaceholderText("a short reason — why does this matter?"),
      ).toBeTruthy();
    });

    it("includes description in submitted data", async () => {
      await act(async () => {
        fireEvent.changeText(view.getByPlaceholderText("morning run"), "Run");
        await flush();
      });
      await act(async () => {
        fireEvent.changeText(
          view.getByPlaceholderText("a short reason — why does this matter?"),
          "Go for a run",
        );
        await flush();
      });
      await act(async () => {
        fireEvent.press(view.getByText("start nagging me"));
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

describe("schedule editor", () => {
  let view: ReturnType<typeof render>;

  beforeEach(async () => {
    view = render(<HabitForm onSubmit={onSubmit} />);
    await act(async () => {
      fireEvent.press(view.getByText("scheduled"));
    });
    await act(async () => {
      fireEvent.press(view.getByText("add time"));
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

describe("icon picker", () => {
  let view: ReturnType<typeof render>;

  beforeEach(async () => {
    view = render(<HabitForm onSubmit={onSubmit} />);
    await act(async () => {});
  });

  it("includes icon: null in submitted data by default", async () => {
    await act(async () => {
      fireEvent.changeText(view.getByPlaceholderText("morning run"), "Run");
      await flush();
    });
    await act(async () => {
      fireEvent.press(view.getByText("start nagging me"));
      await flush();
    });
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ icon: null });
  });

  it("submits selected icon when picker is opened and a glyph is tapped", async () => {
    await act(async () => {
      fireEvent.changeText(view.getByPlaceholderText("morning run"), "Run");
      await flush();
    });
    await act(async () => {
      fireEvent.press(view.getByLabelText("Choose icon"));
    });
    await act(async () => {
      fireEvent.press(view.getByLabelText("Icon run"));
      await flush();
    });
    await act(async () => {
      fireEvent.press(view.getByText("start nagging me"));
      await flush();
    });
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ icon: "run" });
  });
});
