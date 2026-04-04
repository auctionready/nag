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
  describe("loading state", () => {
    it("renders loading text", () => {
      const { getByText } = render(
        <HabitDetail {...baseProps} loading={true} />,
      );
      expect(getByText("Loading...")).toBeTruthy();
    });
  });

  describe("basic rendering", () => {
    it("renders the title", () => {
      const { getByText } = render(<HabitDetail {...baseProps} />);
      expect(getByText("Exercise")).toBeTruthy();
    });

    it("renders description when provided", () => {
      const { getByText } = render(
        <HabitDetail {...baseProps} description="Daily workout" />,
      );
      expect(getByText("Daily workout")).toBeTruthy();
    });

    it("does not render description when null", () => {
      const { queryByText } = render(
        <HabitDetail {...baseProps} description={null} />,
      );
      expect(queryByText("Daily workout")).toBeNull();
    });

    it("renders goal text when provided", () => {
      const { getByText } = render(
        <HabitDetail {...baseProps} goalText="3x per week" />,
      );
      expect(getByText("Goal: 3x per week")).toBeTruthy();
    });

    it("does not render goal text when null", () => {
      const { queryByText } = render(
        <HabitDetail {...baseProps} goalText={null} />,
      );
      expect(queryByText(/Goal:/)).toBeNull();
    });

    it("shows empty state when no check-ins", () => {
      const { getByText } = render(<HabitDetail {...baseProps} />);
      expect(getByText("No check-ins yet")).toBeTruthy();
    });
  });

  describe("buttons", () => {
    it("calls onCheckIn when Check-in is pressed", () => {
      const { getByText } = render(<HabitDetail {...baseProps} />);
      fireEvent.press(getByText("Check-in"));
      expect(baseProps.onCheckIn).toHaveBeenCalledTimes(1);
    });

    it("calls onEdit when Edit is pressed", () => {
      const { getByText } = render(<HabitDetail {...baseProps} />);
      fireEvent.press(getByText("Edit"));
      expect(baseProps.onEdit).toHaveBeenCalledTimes(1);
    });

    it("shows Skip button when showSkip is true", () => {
      const { getByText } = render(
        <HabitDetail {...baseProps} showSkip={true} />,
      );
      expect(getByText("Skip")).toBeTruthy();
    });

    it("hides Skip button when showSkip is false", () => {
      const { queryByText } = render(
        <HabitDetail {...baseProps} showSkip={false} />,
      );
      expect(queryByText("Skip")).toBeNull();
    });

    it("calls onSkip when Skip is pressed", () => {
      const { getByText } = render(
        <HabitDetail {...baseProps} showSkip={true} />,
      );
      fireEvent.press(getByText("Skip"));
      expect(baseProps.onSkip).toHaveBeenCalledTimes(1);
    });
  });

  describe("check-in removal", () => {
    const checkIns = [
      { id: 1, timestamp: new Date("2025-06-15T10:00:00"), skipped: null },
      { id: 2, timestamp: new Date("2025-06-16T10:00:00"), skipped: true },
    ];

    it("shows confirmation alert when Remove is pressed", () => {
      jest.spyOn(Alert, "alert");
      const { getAllByText } = render(
        <HabitDetail {...baseProps} checkIns={checkIns} />,
      );
      const removeButtons = getAllByText("Remove");
      fireEvent.press(removeButtons[0]);
      expect(Alert.alert).toHaveBeenCalledWith(
        "Remove Check-in",
        "Are you sure?",
        expect.any(Array),
      );
    });

    it("calls onRemoveCheckIn when confirmed", () => {
      jest.spyOn(Alert, "alert");
      const onRemoveCheckIn = jest.fn();
      const { getAllByText } = render(
        <HabitDetail
          {...baseProps}
          checkIns={checkIns}
          onRemoveCheckIn={onRemoveCheckIn}
        />,
      );
      fireEvent.press(getAllByText("Remove")[0]);
      const buttons = (Alert.alert as jest.Mock).mock.calls[0][2];
      buttons.find((b: any) => b.text === "Remove").onPress();
      expect(onRemoveCheckIn).toHaveBeenCalledWith(1);
    });

    it("renders skipped label for skipped check-ins", () => {
      const { getByText } = render(
        <HabitDetail {...baseProps} checkIns={checkIns} />,
      );
      expect(getByText("(skipped)")).toBeTruthy();
    });
  });
});
