import { render, fireEvent } from "@testing-library/react-native";
import { Alert } from "react-native";
import { HabitDetail } from "../HabitDetail";

const baseProps = {
  title: "Exercise",
  description: null as string | null,
  goalText: null as string | null,
  checkIns: [] as { id: number; timestamp: Date; skipped: boolean | null }[],
  showSkip: false,
  onCheckIn: jest.fn(),
  onSkip: jest.fn(),
  onEdit: jest.fn(),
  onRemoveCheckIn: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("HabitDetail", () => {
  describe("when loading", () => {
    it("renders loading text", () => {
      const { getByText } = render(
        <HabitDetail {...baseProps} loading={true} />,
      );
      expect(getByText("Loading...")).toBeTruthy();
    });
  });

  describe("with no description, goal, or check-ins", () => {
    let view: ReturnType<typeof render>;

    beforeEach(() => {
      view = render(<HabitDetail {...baseProps} />);
    });

    it("renders the title", () => {
      expect(view.getByText("Exercise")).toBeTruthy();
    });

    it("does not render description", () => {
      expect(view.queryByText("Daily workout")).toBeNull();
    });

    it("does not render goal text", () => {
      expect(view.queryByText(/Goal:/)).toBeNull();
    });

    it("shows empty check-in state", () => {
      expect(view.getByText("No check-ins yet")).toBeTruthy();
    });

    it("calls onCheckIn when Check-in is pressed", () => {
      fireEvent.press(view.getByText("Check-in"));
      expect(baseProps.onCheckIn).toHaveBeenCalledTimes(1);
    });

    it("calls onEdit when Edit is pressed", () => {
      fireEvent.press(view.getByText("Edit"));
      expect(baseProps.onEdit).toHaveBeenCalledTimes(1);
    });

    it("hides Skip button", () => {
      expect(view.queryByText("Skip")).toBeNull();
    });
  });

  describe("with description and goal", () => {
    let view: ReturnType<typeof render>;

    beforeEach(() => {
      view = render(
        <HabitDetail
          {...baseProps}
          description="Daily workout"
          goalText="3x per week"
        />,
      );
    });

    it("renders description", () => {
      expect(view.getByText("Daily workout")).toBeTruthy();
    });

    it("renders goal text", () => {
      expect(view.getByText("Goal: 3x per week")).toBeTruthy();
    });
  });

  describe("with showSkip enabled", () => {
    let view: ReturnType<typeof render>;

    beforeEach(() => {
      view = render(<HabitDetail {...baseProps} showSkip={true} />);
    });

    it("shows Skip button", () => {
      expect(view.getByText("Skip")).toBeTruthy();
    });

    it("calls onSkip when pressed", () => {
      fireEvent.press(view.getByText("Skip"));
      expect(baseProps.onSkip).toHaveBeenCalledTimes(1);
    });
  });

  describe("with check-ins including a skipped one", () => {
    const checkIns = [
      { id: 1, timestamp: new Date("2025-06-15T10:00:00"), skipped: null },
      { id: 2, timestamp: new Date("2025-06-16T10:00:00"), skipped: true },
    ];
    let view: ReturnType<typeof render>;

    beforeEach(() => {
      jest.spyOn(Alert, "alert");
      view = render(<HabitDetail {...baseProps} checkIns={checkIns} />);
    });

    it("renders skipped label", () => {
      expect(view.getByText("(skipped)")).toBeTruthy();
    });

    describe("when Remove is pressed", () => {
      beforeEach(() => {
        fireEvent.press(view.getAllByText("Remove")[0]);
      });

      it("shows confirmation alert", () => {
        expect(Alert.alert).toHaveBeenCalledWith(
          "Remove Check-in",
          "Are you sure?",
          expect.any(Array),
        );
      });

      it("calls onRemoveCheckIn when confirmed", () => {
        const buttons = (Alert.alert as jest.Mock).mock.calls[0][2];
        buttons.find((b: any) => b.text === "Remove").onPress();
        expect(baseProps.onRemoveCheckIn).toHaveBeenCalledWith(1);
      });
    });
  });
});
