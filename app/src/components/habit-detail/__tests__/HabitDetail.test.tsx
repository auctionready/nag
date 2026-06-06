import type { ReactElement } from "react";
import { fireEvent } from "@testing-library/react-native";
import type { ScheduleInfo } from "@nag/core";
import { Day } from "@nag/core";
import { HabitDetail } from "../HabitDetail";
import { complianceColors } from "../../../components/compliance";
import { renderWithToday } from "../../../test-utils/renderWithToday";

// 2025-06-15 is a Sunday — historical fixture for the "now" clock.
const sundayAt = (h: number, m = 0) => new Date(2025, 5, 15, h, m);

const render = (ui: ReactElement, now: Date = sundayAt(10)) =>
  renderWithToday(ui, { now });

const baseProps = {
  title: "Exercise",
  description: null as string | null,
  icon: null as string | null,
  goalText: null as string | null,
  regularity: null as null | "day" | "week" | "month",
  frequency: null as number | null,
  checkInsThisPeriod: 0,
  schedules: [] as ScheduleInfo[],
  checkIns: [] as {
    id: string;
    timestamp: Date;
    createdAt: Date;
    updatedAt: Date;
    skipped: boolean | null;
  }[],
  showSkip: false,
  selectedDay: null as Date | null,
  onSelectDay: jest.fn(),
  onOpenHistory: jest.fn(),
  onCheckInAt: jest.fn(),
  onSkipAt: jest.fn(),
  onEdit: jest.fn(),
  onBack: jest.fn(),
  onRemoveCheckIn: jest.fn(),
  onEditCheckInTimestamp: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
  // `useStartOfToday` resolves at provider mount and `new Date()` reads
  // happen per render — fake timers anchor both to the fixture clock.
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe("HabitDetail", () => {
  describe("loading", () => {
    it("renders loading text", async () => {
      const { getByText } = await render(
        <HabitDetail {...baseProps} loading />,
      );
      expect(getByText("Loading...")).toBeTruthy();
    });
  });

  describe("hero card", () => {
    it("renders the title (lower-cased per design)", async () => {
      const view = await render(<HabitDetail {...baseProps} />);
      expect(view.getByText("exercise")).toBeTruthy();
    });

    it("renders the description as a quiet note", async () => {
      const view = await render(
        <HabitDetail {...baseProps} description="Daily workout" />,
      );
      expect(view.getByText("Daily workout")).toBeTruthy();
    });

    it("renders a cadence summary derived from regularity + frequency", async () => {
      const view = await render(
        <HabitDetail {...baseProps} regularity="week" frequency={3} />,
      );
      expect(view.getByText("3× / wk")).toBeTruthy();
    });
  });

  describe("action footer", () => {
    it("hides Skip when showSkip is false", async () => {
      const view = await render(<HabitDetail {...baseProps} />);
      expect(view.queryByLabelText("Skip")).toBeNull();
    });

    it("shows Skip when showSkip is true", async () => {
      const view = await render(<HabitDetail {...baseProps} showSkip />);
      expect(view.getByLabelText("Skip")).toBeTruthy();
    });

    it("Check-in calls onCheckInAt with a fresh Date", async () => {
      const view = await render(<HabitDetail {...baseProps} />);
      const before = Date.now();
      await fireEvent.press(view.getByLabelText("Check-in"));
      const after = Date.now();
      expect(baseProps.onCheckInAt).toHaveBeenCalledTimes(1);
      const [called] = baseProps.onCheckInAt.mock.calls[0];
      expect(called).toBeInstanceOf(Date);
      expect((called as Date).getTime()).toBeGreaterThanOrEqual(before);
      expect((called as Date).getTime()).toBeLessThanOrEqual(after);
    });

    it("Skip calls onSkipAt with a fresh Date", async () => {
      const view = await render(<HabitDetail {...baseProps} showSkip />);
      const before = Date.now();
      await fireEvent.press(view.getByLabelText("Skip"));
      const after = Date.now();
      expect(baseProps.onSkipAt).toHaveBeenCalledTimes(1);
      const [called] = baseProps.onSkipAt.mock.calls[0];
      expect((called as Date).getTime()).toBeGreaterThanOrEqual(before);
      expect((called as Date).getTime()).toBeLessThanOrEqual(after);
    });

    it("relabels the primary action as a bonus on an off-day", async () => {
      // Mon-Fri schedule, "now" is a Sunday → today is an off-day.
      const weekdays = Day.Mon | Day.Tue | Day.Wed | Day.Thu | Day.Fri;
      const view = await render(
        <HabitDetail
          {...baseProps}
          regularity="week"
          frequency={3}
          // Even with showSkip on, the Skip action is suppressed on off-days.
          showSkip
          schedules={[
            { days: weekdays, dayOfMonth: null, hour: 21, minute: 30 },
          ]}
        />,
      );
      expect(view.getByText("Off-day extra")).toBeTruthy();
      expect(view.getByLabelText("Log off-day extra")).toBeTruthy();
      // The primary button's own label flips away from "Check-in" (the
      // empty-state hint still contains that word, so assert via label).
      expect(view.queryByLabelText("Check-in")).toBeNull();
      // Skip is meaningless on an off-day → hidden even though showSkip is set.
      expect(view.queryByLabelText("Skip")).toBeNull();
    });

    it("keeps the Check-in label on a scheduled day", async () => {
      // Same schedule but "now" is a Wednesday → a scheduled day.
      const weekdays = Day.Mon | Day.Tue | Day.Wed | Day.Thu | Day.Fri;
      const view = await render(
        <HabitDetail
          {...baseProps}
          regularity="week"
          frequency={3}
          schedules={[
            { days: weekdays, dayOfMonth: null, hour: 21, minute: 30 },
          ]}
        />,
        // 2025-06-18 is a Wednesday.
        new Date(2025, 5, 18, 10, 0),
      );
      expect(view.getByLabelText("Check-in")).toBeTruthy();
      expect(view.queryByText("Off-day extra")).toBeNull();
    });
  });

  describe("header buttons", () => {
    it("Edit triggers onEdit", async () => {
      const view = await render(<HabitDetail {...baseProps} />);
      await fireEvent.press(view.getByLabelText("Edit"));
      expect(baseProps.onEdit).toHaveBeenCalledTimes(1);
    });

    it("Back triggers onBack", async () => {
      const view = await render(<HabitDetail {...baseProps} />);
      await fireEvent.press(view.getByLabelText("Back"));
      expect(baseProps.onBack).toHaveBeenCalledTimes(1);
    });

    it("History triggers onOpenHistory", async () => {
      const view = await render(<HabitDetail {...baseProps} />);
      await fireEvent.press(view.getByLabelText("History"));
      expect(baseProps.onOpenHistory).toHaveBeenCalledTimes(1);
    });
  });

  describe("scheduled-day slot pills", () => {
    const schedules: ScheduleInfo[] = [
      { days: null, dayOfMonth: null, hour: 8, minute: 0 },
      { days: null, dayOfMonth: null, hour: 12, minute: 0 },
      { days: null, dayOfMonth: null, hour: 18, minute: 0 },
    ];

    it("renders a pill per scheduled slot", async () => {
      const view = await render(
        <HabitDetail
          {...baseProps}
          regularity="day"
          frequency={3}
          schedules={schedules}
        />,
      );
      // Slot pill splits time and AM/PM into separate text nodes.
      expect(view.getByText("8:00")).toBeTruthy();
      expect(view.getByText("12:00")).toBeTruthy();
      expect(view.getByText("6:00")).toBeTruthy();
      expect(view.getAllByText("AM").length).toBeGreaterThan(0);
      expect(view.getAllByText("PM").length).toBeGreaterThan(0);
    });

    it("counts done / total in the schedule eyebrow", async () => {
      const view = await render(
        <HabitDetail
          {...baseProps}
          regularity="day"
          frequency={3}
          schedules={schedules}
          checkIns={[
            {
              id: "ci-1",
              timestamp: sundayAt(8),
              createdAt: sundayAt(8),
              updatedAt: sundayAt(8),
              skipped: null,
            },
          ]}
        />,
      );
      expect(view.getByText("1 / 3")).toBeTruthy();
    });

    it("missed pills are interactive (tap → opens actions popover)", async () => {
      const view = await render(
        <HabitDetail
          {...baseProps}
          regularity="day"
          frequency={3}
          schedules={schedules}
        />,
        // 14:00 → 8AM and 12PM are past + unfilled (missed → owed pills).
        sundayAt(14),
      );
      // The owed (past, unfilled) pill exposes a tap-to-act affordance so
      // back-filling specific gaps is discoverable via a11y.
      expect(view.queryByLabelText("Open actions for 8:00 AM")).not.toBeNull();
    });

    it("done pills open the delete-mode popover (no log actions)", async () => {
      const checkInTs = sundayAt(8, 30);
      const view = await render(
        <HabitDetail
          {...baseProps}
          regularity="day"
          frequency={3}
          schedules={schedules}
          checkIns={[
            {
              id: "ci-1",
              timestamp: checkInTs,
              createdAt: checkInTs,
              updatedAt: checkInTs,
              skipped: null,
            },
          ]}
        />,
        sundayAt(14),
      );
      await fireEvent.press(view.getByLabelText("Open actions for 8:00 AM"));
      // Undo is the only action in undo mode — check-in/skip absent.
      expect(view.queryByLabelText("check in")).toBeNull();
      expect(view.queryByLabelText("skip")).toBeNull();
      await fireEvent.press(view.getByLabelText("undo check-in"));
      expect(baseProps.onRemoveCheckIn).toHaveBeenCalledWith("ci-1");
    });

    it("skipped pills open undo-skip popover", async () => {
      const skipTs = sundayAt(8, 30);
      const view = await render(
        <HabitDetail
          {...baseProps}
          regularity="day"
          frequency={3}
          schedules={schedules}
          checkIns={[
            {
              id: "ci-skip-1",
              timestamp: skipTs,
              createdAt: skipTs,
              updatedAt: skipTs,
              skipped: true,
            },
          ]}
        />,
        sundayAt(14),
      );
      await fireEvent.press(view.getByLabelText("Open actions for 8:00 AM"));
      await fireEvent.press(view.getByLabelText("undo skip"));
      expect(baseProps.onRemoveCheckIn).toHaveBeenCalledWith("ci-skip-1");
    });

    it("future upcoming pills (beyond next-up) stay inert", async () => {
      // 6:00 — well before any of 8/12/18, so 8AM is the next-up upcoming
      // and 12PM/6PM are still inert future slots.
      const view = await render(
        <HabitDetail
          {...baseProps}
          regularity="day"
          frequency={3}
          schedules={schedules}
        />,
        sundayAt(6),
      );
      expect(view.queryByLabelText("Open actions for 8:00 AM")).not.toBeNull();
      expect(view.queryByLabelText("Open actions for 12:00 PM")).toBeNull();
    });

    it("tapping an owed pill → popover → check-in records at slot's time", async () => {
      const view = await render(
        <HabitDetail
          {...baseProps}
          regularity="day"
          frequency={3}
          schedules={schedules}
        />,
        sundayAt(14),
      );
      await fireEvent.press(view.getByLabelText("Open actions for 8:00 AM"));
      // Popover renders inside a Modal — the "check in" button has an
      // explicit accessibility label.
      await fireEvent.press(view.getByLabelText("check in"));
      expect(baseProps.onCheckInAt).toHaveBeenCalledTimes(1);
      const [called] = baseProps.onCheckInAt.mock.calls[0];
      expect((called as Date).getHours()).toBe(8);
      expect((called as Date).getMinutes()).toBe(0);
    });

    it("tapping an owed pill → popover → skip records at slot's time", async () => {
      const view = await render(
        <HabitDetail
          {...baseProps}
          regularity="day"
          frequency={3}
          schedules={schedules}
        />,
        sundayAt(14),
      );
      await fireEvent.press(view.getByLabelText("Open actions for 12:00 PM"));
      await fireEvent.press(view.getByLabelText("skip"));
      expect(baseProps.onSkipAt).toHaveBeenCalledTimes(1);
      const [called] = baseProps.onSkipAt.mock.calls[0];
      expect((called as Date).getHours()).toBe(12);
      expect((called as Date).getMinutes()).toBe(0);
    });
  });

  describe("week strip", () => {
    const weeklySchedules: ScheduleInfo[] = [
      {
        days: Day.Mon | Day.Wed | Day.Fri,
        dayOfMonth: null,
        hour: 9,
        minute: 0,
      },
    ];

    it("renders for weekly habits with a day-of-week mask", async () => {
      const view = await render(
        <HabitDetail
          {...baseProps}
          regularity="week"
          frequency={3}
          schedules={weeklySchedules}
          complianceColor={complianceColors.partial}
        />,
      );
      // The card carries the eyebrow caption verbatim.
      expect(view.getByText("this week")).toBeTruthy();
    });

    it("tap on a day cell calls onSelectDay with the cell's Date", async () => {
      const view = await render(
        <HabitDetail
          {...baseProps}
          regularity="week"
          frequency={3}
          schedules={weeklySchedules}
        />,
      );
      // Mon Jun 9 + 2 = Wed Jun 11.
      await fireEvent.press(view.getByLabelText("Select Wednesday"));
      expect(baseProps.onSelectDay).toHaveBeenCalledTimes(1);
      const [called] = baseProps.onSelectDay.mock.calls[0];
      expect((called as Date).getDate()).toBe(11);
    });

    it("re-tap on the selected day passes null to clear the selection", async () => {
      const wed = new Date(2025, 5, 11);
      const view = await render(
        <HabitDetail
          {...baseProps}
          regularity="week"
          frequency={3}
          schedules={weeklySchedules}
          selectedDay={wed}
        />,
      );
      await fireEvent.press(view.getByLabelText("Select Wednesday"));
      expect(baseProps.onSelectDay).toHaveBeenCalledWith(null);
    });

    it("future day cells are disabled and don't fire onSelectDay", async () => {
      const wedNow = new Date(2025, 5, 11, 10);
      const view = await render(
        <HabitDetail
          {...baseProps}
          regularity="week"
          frequency={3}
          schedules={weeklySchedules}
        />,
        wedNow,
      );
      await fireEvent.press(view.getByLabelText("Select Friday"));
      expect(baseProps.onSelectDay).not.toHaveBeenCalled();
      const friday = view.getByLabelText("Select Friday");
      expect(friday.props.accessibilityState).toEqual(
        expect.objectContaining({ disabled: true }),
      );
    });
  });

  describe("check-ins panel", () => {
    it("shows entry count + 'entries' for multiple check-ins", async () => {
      const view = await render(
        <HabitDetail
          {...baseProps}
          regularity="day"
          frequency={1}
          checkIns={[
            {
              id: "ci-1",
              timestamp: sundayAt(8),
              createdAt: sundayAt(8),
              updatedAt: sundayAt(8),
              skipped: null,
            },
            {
              id: "ci-2",
              timestamp: sundayAt(9),
              createdAt: sundayAt(9),
              updatedAt: sundayAt(9),
              skipped: null,
            },
          ]}
        />,
      );
      expect(view.getByText("2 entries")).toBeTruthy();
    });

    it("shows '1 entry' when only one check-in is in the window", async () => {
      const view = await render(
        <HabitDetail
          {...baseProps}
          regularity="day"
          frequency={1}
          checkIns={[
            {
              id: "ci-1",
              timestamp: sundayAt(8),
              createdAt: sundayAt(8),
              updatedAt: sundayAt(8),
              skipped: null,
            },
          ]}
        />,
      );
      expect(view.getByText("1 entry")).toBeTruthy();
    });

    it("labels an off-day check-in as an off-day extra", async () => {
      // Mon-Fri schedule, check-in (and "now") on Sunday → off-day extra.
      const weekdays = Day.Mon | Day.Tue | Day.Wed | Day.Thu | Day.Fri;
      const view = await render(
        <HabitDetail
          {...baseProps}
          regularity="week"
          frequency={3}
          schedules={[
            { days: weekdays, dayOfMonth: null, hour: 21, minute: 30 },
          ]}
          checkIns={[
            {
              id: "ci-sun",
              timestamp: sundayAt(8),
              createdAt: sundayAt(8),
              updatedAt: sundayAt(8),
              skipped: null,
            },
          ]}
        />,
      );
      expect(view.getByText("off-day extra")).toBeTruthy();
      expect(view.queryByText("logged")).toBeNull();
    });

    it("labels a scheduled-day check-in as logged", async () => {
      const weekdays = Day.Mon | Day.Tue | Day.Wed | Day.Thu | Day.Fri;
      const view = await render(
        <HabitDetail
          {...baseProps}
          regularity="week"
          frequency={3}
          schedules={[
            { days: weekdays, dayOfMonth: null, hour: 21, minute: 30 },
          ]}
          checkIns={[
            {
              id: "ci-wed",
              timestamp: new Date(2025, 5, 18, 21, 30),
              createdAt: new Date(2025, 5, 18, 21, 30),
              updatedAt: new Date(2025, 5, 18, 21, 30),
              skipped: null,
            },
          ]}
          // 2025-06-18 is a Wednesday — a scheduled day.
        />,
        new Date(2025, 5, 18, 22, 0),
      );
      expect(view.getByText("logged")).toBeTruthy();
      expect(view.queryByText("off-day extra")).toBeNull();
    });

    it("scopes the list to the selected day", async () => {
      const wed = new Date(2025, 5, 11);
      const view = await render(
        <HabitDetail
          {...baseProps}
          regularity="week"
          frequency={3}
          selectedDay={wed}
          checkIns={[
            {
              id: "ci-mon",
              timestamp: new Date(2025, 5, 9, 10),
              createdAt: new Date(2025, 5, 9, 10),
              updatedAt: new Date(2025, 5, 9, 10),
              skipped: null,
            },
            {
              id: "ci-wed",
              timestamp: new Date(2025, 5, 11, 10),
              createdAt: new Date(2025, 5, 11, 10),
              updatedAt: new Date(2025, 5, 11, 10),
              skipped: null,
            },
          ]}
        />,
      );
      expect(view.getByText("1 entry")).toBeTruthy();
      // Time-only format when scoped to a single day.
      expect(view.getByText("10:00 AM")).toBeTruthy();
    });

    it("renders a friendly empty state with a back-fill hint", async () => {
      const view = await render(<HabitDetail {...baseProps} />);
      expect(view.getByText("nothing logged this day.")).toBeTruthy();
    });
  });
});
