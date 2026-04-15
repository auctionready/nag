import { render, fireEvent } from "@testing-library/react-native";
import { Alert } from "react-native";
import type { ScheduleInfo } from "@nag/core";
import { Day } from "@nag/core";
import { HabitDetail } from "../HabitDetail";
import { complianceColors } from "../getComplianceColor";

// 2025-06-15 is a Sunday
const sundayAt = (h: number, m = 0) => new Date(2025, 5, 15, h, m);

const baseProps = {
  title: "Exercise",
  description: null as string | null,
  goalText: null as string | null,
  regularity: null as null | "day" | "week" | "month",
  frequency: null as number | null,
  checkInsThisPeriod: 0,
  schedules: [] as ScheduleInfo[],
  checkIns: [] as { id: number; timestamp: Date; skipped: boolean | null }[],
  showSkip: false,
  onCheckIn: jest.fn(),
  onSkip: jest.fn(),
  onEdit: jest.fn(),
  onRemoveCheckIn: jest.fn(),
  now: sundayAt(10),
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
      expect(view.queryByText(/weekly/)).toBeNull();
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
          goalText="3x weekly"
        />,
      );
    });

    it("renders description", () => {
      expect(view.getByText("Daily workout")).toBeTruthy();
    });

    it("renders goal pill text", () => {
      expect(view.getByText("3x weekly")).toBeTruthy();
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

  describe("with timed schedules", () => {
    const schedules: ScheduleInfo[] = [
      { days: null, dayOfMonth: null, hour: 8, minute: 0 },
      { days: null, dayOfMonth: null, hour: 12, minute: 0 },
      { days: null, dayOfMonth: null, hour: 18, minute: 0 },
    ];

    it("renders a chip for each scheduled slot today", () => {
      const view = render(
        <HabitDetail
          {...baseProps}
          regularity="day"
          frequency={3}
          schedules={schedules}
        />,
      );
      expect(view.getByText("8:00 AM")).toBeTruthy();
      expect(view.getByText("12:00 PM")).toBeTruthy();
      expect(view.getByText("6:00 PM")).toBeTruthy();
    });

    it("shows 'N of M done today' headline", () => {
      const view = render(
        <HabitDetail
          {...baseProps}
          regularity="day"
          frequency={3}
          schedules={schedules}
          checkIns={[{ id: 1, timestamp: sundayAt(9), skipped: null }]}
        />,
      );
      expect(view.getByText("1 of 3 done today")).toBeTruthy();
    });

    it("shows extras pill when there are more check-ins than slots", () => {
      const view = render(
        <HabitDetail
          {...baseProps}
          regularity="day"
          frequency={3}
          schedules={schedules}
          checkIns={[
            { id: 1, timestamp: sundayAt(8, 30), skipped: null },
            { id: 2, timestamp: sundayAt(12, 30), skipped: null },
            { id: 3, timestamp: sundayAt(18, 30), skipped: null },
            { id: 4, timestamp: sundayAt(19, 30), skipped: null },
          ]}
          now={sundayAt(20)}
        />,
      );
      expect(view.getByText("+1 extra")).toBeTruthy();
    });
  });

  describe("weekly habit with day-only schedules", () => {
    it("renders the week strip", () => {
      const view = render(
        <HabitDetail
          {...baseProps}
          regularity="week"
          frequency={3}
          schedules={[
            {
              days: Day.Mon | Day.Wed | Day.Fri,
              dayOfMonth: null,
              hour: 9,
              minute: 0,
            },
          ]}
          complianceColor={complianceColors.partial}
        />,
      );
      expect(view.getByText("This week")).toBeTruthy();
    });
  });

  describe("frequency-only habit (no timed schedule)", () => {
    it("shows period progress headline", () => {
      const view = render(
        <HabitDetail
          {...baseProps}
          regularity="week"
          frequency={3}
          checkInsThisPeriod={2}
        />,
      );
      expect(view.getByText("2 of 3 this period")).toBeTruthy();
    });
  });

  describe("with check-ins including a skipped one", () => {
    const checkIns = [
      { id: 1, timestamp: new Date("2025-06-15T10:00:00"), skipped: null },
      { id: 2, timestamp: new Date("2025-06-16T10:00:00"), skipped: true },
    ];

    beforeEach(() => {
      jest.spyOn(Alert, "alert");
    });

    it("shows a collapsed 'Recent check-ins' header by default", () => {
      const view = render(<HabitDetail {...baseProps} checkIns={checkIns} />);
      expect(view.getByText("Recent check-ins (2)")).toBeTruthy();
      // collapsed by default — Remove button should not be rendered
      expect(view.queryByText("Remove")).toBeNull();
    });

    describe("when expanded and Remove is pressed", () => {
      it("calls onRemoveCheckIn with the check-in id", () => {
        const view = render(<HabitDetail {...baseProps} checkIns={checkIns} />);
        fireEvent.press(view.getByText("Recent check-ins (2)"));
        expect(view.getByText("(skipped)")).toBeTruthy();
        fireEvent.press(view.getAllByText("Remove")[0]);
        expect(Alert.alert).toHaveBeenCalledWith(
          "Remove Check-in",
          "Are you sure?",
          expect.any(Array),
        );
        const buttons = (Alert.alert as jest.Mock).mock.calls[0][2];
        buttons.find((b: { text: string }) => b.text === "Remove").onPress();
        expect(baseProps.onRemoveCheckIn).toHaveBeenCalledWith(1);
      });
    });
  });
});
