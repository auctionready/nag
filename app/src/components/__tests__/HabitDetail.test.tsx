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
  selectedDay: null as Date | null,
  onSelectDay: jest.fn(),
  onCheckInAt: jest.fn(),
  onSkipAt: jest.fn(),
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

    it("calls onCheckInAt with the current `now` when Check-in is pressed", () => {
      fireEvent.press(view.getByText("Check-in"));
      expect(baseProps.onCheckInAt).toHaveBeenCalledTimes(1);
      expect(baseProps.onCheckInAt).toHaveBeenCalledWith(baseProps.now);
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

    it("calls onSkipAt with the current `now` when pressed", () => {
      fireEvent.press(view.getByText("Skip"));
      expect(baseProps.onSkipAt).toHaveBeenCalledTimes(1);
      expect(baseProps.onSkipAt).toHaveBeenCalledWith(baseProps.now);
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

    it("long-pressing a missed slot calls onCheckInAt at that slot's time", () => {
      const view = render(
        <HabitDetail
          {...baseProps}
          regularity="day"
          frequency={3}
          schedules={schedules}
          // No check-ins + now=14:00 → 8AM & 12PM chips are `missed`
          now={sundayAt(14)}
        />,
      );
      fireEvent(view.getByText("8:00 AM"), "longPress");
      expect(baseProps.onCheckInAt).toHaveBeenCalledTimes(1);
      const [called] = baseProps.onCheckInAt.mock.calls[0];
      expect(called).toBeInstanceOf(Date);
      expect((called as Date).getHours()).toBe(8);
      expect((called as Date).getMinutes()).toBe(0);
      // Selected day defaults to `now` (Sun 2025-06-15) when no `selectedDay`.
      expect((called as Date).getFullYear()).toBe(2025);
      expect((called as Date).getMonth()).toBe(5);
      expect((called as Date).getDate()).toBe(15);
    });

    it("long-pressing a `done` chip does not trigger onCheckInAt", () => {
      const view = render(
        <HabitDetail
          {...baseProps}
          regularity="day"
          frequency={3}
          schedules={schedules}
          checkIns={[{ id: 1, timestamp: sundayAt(8, 30), skipped: null }]}
          now={sundayAt(10)}
        />,
      );
      fireEvent(view.getByText("8:00 AM"), "longPress");
      expect(baseProps.onCheckInAt).not.toHaveBeenCalled();
    });
  });

  describe("weekly habit with day-only schedules", () => {
    const weeklySchedules: ScheduleInfo[] = [
      {
        days: Day.Mon | Day.Wed | Day.Fri,
        dayOfMonth: null,
        hour: 9,
        minute: 0,
      },
    ];

    it("renders the week strip", () => {
      const view = render(
        <HabitDetail
          {...baseProps}
          regularity="week"
          frequency={3}
          schedules={weeklySchedules}
          complianceColor={complianceColors.partial}
        />,
      );
      expect(view.getByText("This week")).toBeTruthy();
    });

    it("tapping a day cell calls onSelectDay with that day's Date", () => {
      const view = render(
        <HabitDetail
          {...baseProps}
          regularity="week"
          frequency={3}
          schedules={weeklySchedules}
          complianceColor={complianceColors.partial}
        />,
      );
      // Week strip is Monday-first. `now` is Sun Jun 15 2025 → Mon is Jun 9.
      // Tap Wednesday (index 2 → Wed Jun 11 2025).
      fireEvent.press(view.getByLabelText("Select Wednesday"));
      expect(baseProps.onSelectDay).toHaveBeenCalledTimes(1);
      const [called] = baseProps.onSelectDay.mock.calls[0];
      expect(called).toBeInstanceOf(Date);
      expect((called as Date).getDay()).toBe(3); // Wednesday
      expect((called as Date).getDate()).toBe(11);
    });

    it("re-tapping the selected day clears the selection (passes null)", () => {
      const wed = new Date(2025, 5, 11);
      const view = render(
        <HabitDetail
          {...baseProps}
          regularity="week"
          frequency={3}
          schedules={weeklySchedules}
          complianceColor={complianceColors.partial}
          selectedDay={wed}
        />,
      );
      fireEvent.press(view.getByLabelText("Select Wednesday"));
      expect(baseProps.onSelectDay).toHaveBeenCalledWith(null);
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

  describe("period-scoped check-in list", () => {
    // Sun Jun 15 is `now`; Mon Jun 9 2025 is the start of the week.
    const mondayAt = (h: number) => new Date(2025, 5, 9, h, 0);
    const wednesdayAt = (h: number) => new Date(2025, 5, 11, h, 0);
    const checkIns = [
      { id: 1, timestamp: mondayAt(10), skipped: null as boolean | null },
      { id: 2, timestamp: wednesdayAt(10), skipped: null as boolean | null },
      { id: 3, timestamp: sundayAt(9), skipped: null as boolean | null },
    ];

    it("shows 'This Week's Check-ins (3)' for a weekly habit, expanded by default", () => {
      const view = render(
        <HabitDetail
          {...baseProps}
          regularity="week"
          frequency={3}
          checkIns={checkIns}
        />,
      );
      expect(view.getByText("This Week's Check-ins (3)")).toBeTruthy();
      // Expanded by default → Remove buttons visible.
      expect(view.getAllByText("Remove")).toHaveLength(3);
    });

    it("shows 'Today's Check-ins' for a daily habit and filters to today", () => {
      const view = render(
        <HabitDetail
          {...baseProps}
          regularity="day"
          frequency={1}
          checkIns={checkIns}
        />,
      );
      // Only the Sunday check-in should be listed.
      expect(view.getByText("Today's Check-ins (1)")).toBeTruthy();
      expect(view.getAllByText("Remove")).toHaveLength(1);
    });

    it('shows "{Weekday}\'s Check-ins" when a day is selected, filtered to that day', () => {
      const view = render(
        <HabitDetail
          {...baseProps}
          regularity="week"
          frequency={3}
          checkIns={checkIns}
          selectedDay={wednesdayAt(0)}
        />,
      );
      expect(view.getByText("Wednesday's Check-ins (1)")).toBeTruthy();
      expect(view.getAllByText("Remove")).toHaveLength(1);
    });

    it("anchors the day summary card to the selected day", () => {
      // With a Wednesday-only schedule and `selectedDay = Wed`, the card's
      // weekday label should read "Wednesday" instead of today's ("Sunday").
      const view = render(
        <HabitDetail
          {...baseProps}
          regularity="week"
          frequency={1}
          schedules={[{ days: Day.Wed, dayOfMonth: null, hour: 9, minute: 0 }]}
          selectedDay={new Date(2025, 5, 11)}
        />,
      );
      expect(view.getByText("Wednesday")).toBeTruthy();
    });
  });

  describe("with a skipped check-in", () => {
    const checkIns = [
      { id: 1, timestamp: sundayAt(10), skipped: null as boolean | null },
      { id: 2, timestamp: sundayAt(14), skipped: true as boolean | null },
    ];

    beforeEach(() => {
      jest.spyOn(Alert, "alert");
    });

    describe("when Remove is pressed", () => {
      it("calls onRemoveCheckIn with the check-in id", () => {
        const view = render(
          <HabitDetail
            {...baseProps}
            regularity="day"
            frequency={1}
            checkIns={checkIns}
          />,
        );
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
