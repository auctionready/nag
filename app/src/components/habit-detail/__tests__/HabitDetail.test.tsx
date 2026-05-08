import type { ReactElement } from "react";
import { fireEvent } from "@testing-library/react-native";
import { Alert } from "react-native";
import type { ScheduleInfo } from "@nag/core";
import { Day } from "@nag/core";
import { HabitDetail } from "../HabitDetail";
import { complianceColors } from "../../../components/compliance";
import { renderWithToday } from "../../../test-utils/renderWithToday";

// 2025-06-15 is a Sunday
const sundayAt = (h: number, m = 0) => new Date(2025, 5, 15, h, m);

// Local render shim: every test in this suite needs a TodayProvider plus a
// fixed system clock. Default to Sunday 10am — the historical fixture.
// Tests that need a different "now" pass it as the second arg.
const render = (ui: ReactElement, now: Date = sundayAt(10)) =>
  renderWithToday(ui, { now });

const baseProps = {
  title: "Exercise",
  description: null as string | null,
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
  onCheckInAt: jest.fn(),
  onSkipAt: jest.fn(),
  onEdit: jest.fn(),
  onRemoveCheckIn: jest.fn(),
  onEditCheckInTimestamp: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
  // `useStartOfToday` resolves system time at provider mount, and HabitDetail's
  // sub-day logic reads `new Date()` per render. Both must observe the
  // same fixture clock — fake timers anchor them.
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
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

    it("calls onCheckInAt with a fresh `new Date()` when Check-in is pressed", () => {
      // Must be fresh-at-click (not the captured-at-render `now` prop), so
      // that an immediate check-in's deemed timestamp matches `createdAt`
      // and the row doesn't render a misleading "(recorded …)" line.
      const before = Date.now();
      fireEvent.press(view.getByText("Check-in"));
      const after = Date.now();
      expect(baseProps.onCheckInAt).toHaveBeenCalledTimes(1);
      const [called] = baseProps.onCheckInAt.mock.calls[0];
      expect(called).toBeInstanceOf(Date);
      expect((called as Date).getTime()).toBeGreaterThanOrEqual(before);
      expect((called as Date).getTime()).toBeLessThanOrEqual(after);
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

    it("calls onSkipAt with a fresh `new Date()` when pressed", () => {
      const before = Date.now();
      fireEvent.press(view.getByText("Skip"));
      const after = Date.now();
      expect(baseProps.onSkipAt).toHaveBeenCalledTimes(1);
      const [called] = baseProps.onSkipAt.mock.calls[0];
      expect(called).toBeInstanceOf(Date);
      expect((called as Date).getTime()).toBeGreaterThanOrEqual(before);
      expect((called as Date).getTime()).toBeLessThanOrEqual(after);
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
          checkIns={[
            {
              id: "ci-1",
              timestamp: sundayAt(9),
              createdAt: sundayAt(9),
              updatedAt: sundayAt(9),
              skipped: null,
            },
          ]}
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
            {
              id: "ci-1",
              timestamp: sundayAt(8, 30),
              createdAt: sundayAt(8, 30),
              updatedAt: sundayAt(8, 30),
              skipped: null,
            },
            {
              id: "ci-2",
              timestamp: sundayAt(12, 30),
              createdAt: sundayAt(12, 30),
              updatedAt: sundayAt(12, 30),
              skipped: null,
            },
            {
              id: "ci-3",
              timestamp: sundayAt(18, 30),
              createdAt: sundayAt(18, 30),
              updatedAt: sundayAt(18, 30),
              skipped: null,
            },
            {
              id: "ci-4",
              timestamp: sundayAt(19, 30),
              createdAt: sundayAt(19, 30),
              updatedAt: sundayAt(19, 30),
              skipped: null,
            },
          ]}
        />,
        sundayAt(20),
      );
      expect(view.getByText("+1 extra")).toBeTruthy();
    });

    describe("long-pressing a missed slot", () => {
      const renderWithMissedSlots = () =>
        render(
          <HabitDetail
            {...baseProps}
            regularity="day"
            frequency={3}
            schedules={schedules}
          />,
          // No check-ins + now=14:00 → 8AM & 12PM chips are `missed`
          sundayAt(14),
        );

      const triggerLongPressOnEightAm = () => {
        const view = renderWithMissedSlots();
        fireEvent(view.getByText("8:00 AM"), "longPress");
        return view;
      };

      const pressAlertButton = (label: string) => {
        const buttons = (Alert.alert as jest.Mock).mock.calls[0][2];
        const btn = buttons.find((b: { text: string }) => b.text === label);
        btn.onPress?.();
      };

      beforeEach(() => {
        jest.spyOn(Alert, "alert");
      });

      it("opens a Back-fill prompt with Cancel/As Skip/Check In", () => {
        triggerLongPressOnEightAm();
        expect(Alert.alert).toHaveBeenCalledWith(
          "Back-fill check-in?",
          "For 8:00 AM",
          expect.arrayContaining([
            expect.objectContaining({ text: "Cancel" }),
            expect.objectContaining({ text: "As Skip" }),
            expect.objectContaining({ text: "Check In" }),
          ]),
        );
      });

      it("calls onCheckInAt at the slot's time when 'Check In' is pressed", () => {
        triggerLongPressOnEightAm();
        pressAlertButton("Check In");
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

      it("calls onSkipAt at the slot's time when 'As Skip' is pressed", () => {
        triggerLongPressOnEightAm();
        pressAlertButton("As Skip");
        expect(baseProps.onSkipAt).toHaveBeenCalledTimes(1);
        expect(baseProps.onCheckInAt).not.toHaveBeenCalled();
        const [called] = baseProps.onSkipAt.mock.calls[0];
        expect((called as Date).getHours()).toBe(8);
      });

      it("calls neither when 'Cancel' is pressed", () => {
        triggerLongPressOnEightAm();
        pressAlertButton("Cancel");
        expect(baseProps.onCheckInAt).not.toHaveBeenCalled();
        expect(baseProps.onSkipAt).not.toHaveBeenCalled();
      });
    });

    it("does not expose `done` chips as interactive (no long-press affordance)", () => {
      // Direct DOM inspection: a `done` chip should not advertise the
      // back-fill role/label that `missed` chips do. (We can't reliably
      // assert that a disabled gesture-handler gesture *doesn't fire*
      // under jest-expo's mock, so we check the accessibility surface
      // — what the user actually sees.)
      const view = render(
        <HabitDetail
          {...baseProps}
          regularity="day"
          frequency={3}
          schedules={schedules}
          checkIns={[
            {
              id: "ci-1",
              timestamp: sundayAt(8, 30),
              createdAt: sundayAt(8, 30),
              updatedAt: sundayAt(8, 30),
              skipped: null,
            },
          ]}
        />,
        // 14:00 → 12 PM is now missed (past, unfilled).
        sundayAt(14),
      );
      // Missed 12 PM chip is interactive…
      expect(
        view.queryByLabelText("Long-press to add check-in for 12:00 PM"),
      ).not.toBeNull();
      // …but the done 8 AM chip is not.
      expect(
        view.queryByLabelText("Long-press to add check-in for 8:00 AM"),
      ).toBeNull();
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

    describe("future-day navigation", () => {
      // `now` = Wed Jun 11 2025 so Mon/Tue/Wed are past/today and
      // Thu/Fri/Sat/Sun are future — giving us both branches in one setup.
      const wednesdayNow = new Date(2025, 5, 11, 10);

      it("does not call onSelectDay when tapping a future day cell", () => {
        const view = render(
          <HabitDetail
            {...baseProps}
            regularity="week"
            frequency={3}
            schedules={weeklySchedules}
            complianceColor={complianceColors.partial}
          />,
          wednesdayNow,
        );
        fireEvent.press(view.getByLabelText("Select Friday"));
        expect(baseProps.onSelectDay).not.toHaveBeenCalled();
      });

      it("marks future day cells as disabled via accessibilityState", () => {
        const view = render(
          <HabitDetail
            {...baseProps}
            regularity="week"
            frequency={3}
            schedules={weeklySchedules}
            complianceColor={complianceColors.partial}
          />,
          wednesdayNow,
        );
        const friday = view.getByLabelText("Select Friday");
        expect(friday.props.accessibilityState).toEqual(
          expect.objectContaining({ disabled: true }),
        );
      });

      it("still allows selecting today and past days in the same week", () => {
        const view = render(
          <HabitDetail
            {...baseProps}
            regularity="week"
            frequency={3}
            schedules={weeklySchedules}
            complianceColor={complianceColors.partial}
          />,
          wednesdayNow,
        );
        // Past: Monday.
        fireEvent.press(view.getByLabelText("Select Monday"));
        // Today: Wednesday.
        fireEvent.press(view.getByLabelText("Select Wednesday"));
        expect(baseProps.onSelectDay).toHaveBeenCalledTimes(2);
      });
    });

    describe("Sunday-boundary regression", () => {
      // The previous implementation hand-rolled a Sunday-first week start
      // for the week-strip classification, while buildDayCells (and the
      // rest of the app) uses Monday-first via periodStart. That mismatch
      // silently mis-classified Sunday check-ins. This locks in the fix.
      const sundayScheduled: ScheduleInfo[] = [
        {
          days: Day.Sun,
          dayOfMonth: null,
          hour: 9,
          minute: 0,
        },
      ];

      it("a Sunday check-in lights up the Sunday cell green on a Sunday", () => {
        const view = render(
          <HabitDetail
            {...baseProps}
            regularity="week"
            frequency={1}
            goalCreatedAt={new Date(2020, 0, 1)}
            schedules={sundayScheduled}
            complianceColor={complianceColors.compliant}
            checkIns={[
              {
                id: "ci-1",
                timestamp: sundayAt(9, 5),
                createdAt: sundayAt(9, 5),
                updatedAt: sundayAt(9, 5),
                skipped: false,
              },
            ]}
          />,
        );
        // The Pressable wraps a circle View whose style carries the
        // backgroundColor buildDayCells derived. Walk the rendered tree
        // to find the inner circle, then flatten its style array.
        const sundayCell = view.getByLabelText("Select Sunday");
        const circle = sundayCell.children[0] as {
          props: { style: unknown };
        };
        const rawStyles = Array.isArray(circle.props.style)
          ? circle.props.style
          : [circle.props.style];
        const flat = Object.assign({}, ...rawStyles.filter(Boolean));
        expect(flat.backgroundColor).toBe(complianceColors.compliant);
      });
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

  describe("scheduled day-of-week behaviour", () => {
    const monWedFri: ScheduleInfo[] = [
      {
        days: Day.Mon | Day.Wed | Day.Fri,
        dayOfMonth: null,
        hour: 9,
        minute: 0,
      },
    ];

    it('shows "Not scheduled" when the selected day has no slots', () => {
      // `now` defaults to Sunday Jun 15 → today is unscheduled for a
      // Mon/Wed/Fri habit. Should NOT fall through to "0 of 3 this period".
      const view = render(
        <HabitDetail
          {...baseProps}
          regularity="week"
          frequency={3}
          schedules={monWedFri}
          checkInsThisPeriod={1}
        />,
      );
      expect(view.getByText("Not scheduled")).toBeTruthy();
      expect(view.queryByText(/this period/)).toBeNull();
    });

    it('shows "Not scheduled" when an unscheduled past day is selected', () => {
      // Tuesday Jun 10 — past, but not in the Mon/Wed/Fri mask.
      const tuesday = new Date(2025, 5, 10);
      const view = render(
        <HabitDetail
          {...baseProps}
          regularity="week"
          frequency={3}
          schedules={monWedFri}
          checkInsThisPeriod={1}
          selectedDay={tuesday}
        />,
      );
      expect(view.getByText("Not scheduled")).toBeTruthy();
    });

    it("renders future-day chips as upcoming, not missed", () => {
      // Daily habit with 8/12/18 slots; jump to next Sunday (a week ahead).
      const nextSunday = new Date(2025, 5, 22);
      const view = render(
        <HabitDetail
          {...baseProps}
          regularity="day"
          frequency={3}
          schedules={[
            { days: null, dayOfMonth: null, hour: 8, minute: 0 },
            { days: null, dayOfMonth: null, hour: 12, minute: 0 },
            { days: null, dayOfMonth: null, hour: 18, minute: 0 },
          ]}
          selectedDay={nextSunday}
        />,
      );
      // Glyph inventory: ✓ done, – skipped, ✕ missed, ○ upcoming.
      // Future-day slots should all show ○, never ✕.
      expect(view.queryAllByText("\u25CB")).toHaveLength(3);
      expect(view.queryByText("\u2715")).toBeNull();
      expect(view.getByText("0 of 3 done")).toBeTruthy();
      // And they should NOT be back-fillable — you can't check in on the
      // future. The accessibility label is the long-press affordance.
      expect(
        view.queryByLabelText("Long-press to add check-in for 8:00 AM"),
      ).toBeNull();
    });

    it("allows back-fill on the nearest upcoming slot today, not the rest", () => {
      // now = Sun 10:00; 8 AM is missed, 12 PM is the nearest upcoming,
      // 6 PM is also upcoming but further out.
      const view = render(
        <HabitDetail
          {...baseProps}
          regularity="day"
          frequency={3}
          schedules={[
            { days: null, dayOfMonth: null, hour: 8, minute: 0 },
            { days: null, dayOfMonth: null, hour: 12, minute: 0 },
            { days: null, dayOfMonth: null, hour: 18, minute: 0 },
          ]}
        />,
      );
      // Past missed → long-pressable.
      expect(
        view.queryByLabelText("Long-press to add check-in for 8:00 AM"),
      ).not.toBeNull();
      // Nearest upcoming → long-pressable ("I'm doing it now" affordance).
      expect(
        view.queryByLabelText("Long-press to add check-in for 12:00 PM"),
      ).not.toBeNull();
      // Later upcoming → NOT long-pressable (can't pre-record the future).
      expect(
        view.queryByLabelText("Long-press to add check-in for 6:00 PM"),
      ).toBeNull();
    });

    it("triggering long-press on the nearest upcoming slot opens the prompt", () => {
      jest.spyOn(Alert, "alert");
      const view = render(
        <HabitDetail
          {...baseProps}
          regularity="day"
          frequency={3}
          schedules={[
            { days: null, dayOfMonth: null, hour: 8, minute: 0 },
            { days: null, dayOfMonth: null, hour: 12, minute: 0 },
            { days: null, dayOfMonth: null, hour: 18, minute: 0 },
          ]}
        />,
      );
      fireEvent(view.getByText("12:00 PM"), "longPress");
      expect(Alert.alert).toHaveBeenCalledWith(
        "Back-fill check-in?",
        "For 12:00 PM",
        expect.any(Array),
      );
    });
  });

  describe("period-scoped check-in list", () => {
    // Sun Jun 15 is `now`; Mon Jun 9 2025 is the start of the week.
    const mondayAt = (h: number) => new Date(2025, 5, 9, h, 0);
    const wednesdayAt = (h: number) => new Date(2025, 5, 11, h, 0);
    const checkIns = [
      {
        id: "ci-1",
        timestamp: mondayAt(10),
        createdAt: mondayAt(10),
        updatedAt: mondayAt(10),
        skipped: null as boolean | null,
      },
      {
        id: "ci-2",
        timestamp: wednesdayAt(10),
        createdAt: wednesdayAt(10),
        updatedAt: wednesdayAt(10),
        skipped: null as boolean | null,
      },
      {
        id: "ci-3",
        timestamp: sundayAt(9),
        createdAt: sundayAt(9),
        updatedAt: sundayAt(9),
        skipped: null as boolean | null,
      },
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
      // Week scope spans multiple days → full date format.
      expect(view.getByText("Mon, Jun 9, 2025 10:00 AM")).toBeTruthy();
      expect(view.getByText("Wed, Jun 11, 2025 10:00 AM")).toBeTruthy();
      // Remove action per row (rendered inside the Swipeable's right actions).
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
      // Day scope → time-only (date is implied by the heading).
      expect(view.getByText("9:00 AM")).toBeTruthy();
      expect(view.queryByText("Sun, Jun 15, 2025 9:00 AM")).toBeNull();
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
      // Selected-day scope → time-only.
      expect(view.getByText("10:00 AM")).toBeTruthy();
      expect(view.queryByText("Wed, Jun 11, 2025 10:00 AM")).toBeNull();
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

    it("long-presses a missed slot on a past selected day → Check In", () => {
      // Repro for "long-press on a past day schedule item does nothing":
      // weekly habit with Wed schedule, today is Sun, user picks past Wed.
      jest.spyOn(Alert, "alert");
      const view = render(
        <HabitDetail
          {...baseProps}
          regularity="week"
          frequency={1}
          schedules={[{ days: Day.Wed, dayOfMonth: null, hour: 9, minute: 0 }]}
          selectedDay={new Date(2025, 5, 11)}
        />,
      );
      // The card should render a 9:00 AM chip (missed, since Wed is past).
      const chipLabel = view.getByText("9:00 AM");
      fireEvent(chipLabel, "longPress");
      // Confirm via the prompt's "Check In" button.
      const buttons = (Alert.alert as jest.Mock).mock.calls[0][2];
      buttons.find((b: { text: string }) => b.text === "Check In").onPress();
      expect(baseProps.onCheckInAt).toHaveBeenCalledTimes(1);
      const [called] = baseProps.onCheckInAt.mock.calls[0];
      expect(called).toBeInstanceOf(Date);
      expect((called as Date).getDate()).toBe(11); // Wed Jun 11
      expect((called as Date).getHours()).toBe(9);
      expect((called as Date).getMinutes()).toBe(0);
    });
  });

  describe("with a skipped check-in", () => {
    const checkIns = [
      {
        id: "ci-1",
        timestamp: sundayAt(10),
        createdAt: sundayAt(10),
        updatedAt: sundayAt(10),
        skipped: null as boolean | null,
      },
      {
        id: "ci-2",
        timestamp: sundayAt(14),
        createdAt: sundayAt(14),
        updatedAt: sundayAt(14),
        skipped: true as boolean | null,
      },
    ];

    it("calls onRemoveCheckIn immediately when the swipe action is tapped", () => {
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
      expect(baseProps.onRemoveCheckIn).toHaveBeenCalledWith("ci-1");
    });
  });

  describe("back-filled check-in marker", () => {
    // Slot at 8:00 AM, actually recorded at 10:00 AM → back-fill gap of 2h.
    const backFilled = [
      {
        id: "ci-1",
        timestamp: sundayAt(8),
        createdAt: sundayAt(10),
        updatedAt: sundayAt(10),
        skipped: null as boolean | null,
      },
    ];

    it("shows time-only on (recorded …) when same calendar day as the slot", () => {
      // Same-day back-fill: slot at 8 AM, recorded at 10 AM. The day is
      // already shown (or implied by the title) — only the time differs.
      const view = render(
        <HabitDetail
          {...baseProps}
          regularity="week"
          frequency={1}
          checkIns={backFilled}
        />,
      );
      expect(view.getByText("Sun, Jun 15, 2025 8:00 AM")).toBeTruthy();
      expect(view.getByText("(recorded 10:00 AM)")).toBeTruthy();
    });

    it("omits month/year on (recorded …) when same month+year, different day", () => {
      // Slot Sun Jun 15, recorded Mon Jun 16 — same month so month is implied.
      const laterDay = [
        {
          id: "ci-1",
          timestamp: sundayAt(8),
          createdAt: new Date(2025, 5, 16, 10, 0),
          updatedAt: new Date(2025, 5, 16, 10, 0),
          skipped: null as boolean | null,
        },
      ];
      const view = render(
        <HabitDetail
          {...baseProps}
          regularity="day"
          frequency={1}
          checkIns={laterDay}
        />,
      );
      expect(view.getByText("8:00 AM")).toBeTruthy();
      expect(view.getByText("(recorded Mon 16, 10:00 AM)")).toBeTruthy();
    });

    it("omits year on (recorded …) when same year, different month", () => {
      const diffMonth = [
        {
          id: "ci-1",
          timestamp: sundayAt(8),
          createdAt: new Date(2025, 6, 2, 10, 0), // Jul 2
          updatedAt: new Date(2025, 6, 2, 10, 0),
          skipped: null as boolean | null,
        },
      ];
      const view = render(
        <HabitDetail
          {...baseProps}
          regularity="day"
          frequency={1}
          checkIns={diffMonth}
        />,
      );
      expect(view.getByText("(recorded Wed, Jul 2, 10:00 AM)")).toBeTruthy();
    });

    it("shows full date on (recorded …) when different year", () => {
      const diffYear = [
        {
          id: "ci-1",
          timestamp: sundayAt(8),
          createdAt: new Date(2026, 0, 5, 10, 0), // Jan 5 2026
          updatedAt: new Date(2026, 0, 5, 10, 0),
          skipped: null as boolean | null,
        },
      ];
      const view = render(
        <HabitDetail
          {...baseProps}
          regularity="day"
          frequency={1}
          checkIns={diffYear}
        />,
      );
      expect(
        view.getByText("(recorded Mon, Jan 5, 2026 10:00 AM)"),
      ).toBeTruthy();
    });

    it("omits (recorded …) when timestamp and createdAt are within the threshold", () => {
      // 30-second gap — below the 60s back-fill threshold — should NOT show
      // the "(recorded …)" line (fresh check-ins differ by microseconds).
      const fresh = [
        {
          id: "ci-1",
          timestamp: sundayAt(10, 0),
          createdAt: new Date(2025, 5, 15, 10, 0, 30),
          updatedAt: new Date(2025, 5, 15, 10, 0, 30),
          skipped: null as boolean | null,
        },
      ];
      const view = render(
        <HabitDetail
          {...baseProps}
          regularity="day"
          frequency={1}
          checkIns={fresh}
        />,
      );
      expect(view.queryByText(/^\(recorded /)).toBeNull();
    });
  });

  describe("footer Check-in / Skip use click-time, not render-time", () => {
    // Regression: HabitDetail used to pass its captured-at-render `now`
    // prop to the footer handlers. Leaving the screen open for >60s and
    // then tapping Check-in produced a deemed `timestamp` minutes older
    // than `createdAt` (set fresh by the DB at insert time), which
    // tripped the back-fill threshold and rendered "(recorded …)" below
    // an immediate check-in. Both handlers must use a fresh `new Date()`
    // at click time.

    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("Check-in uses fake-clock at click, not the rendered `now` prop", () => {
      const renderTime = sundayAt(10); // matches baseProps.now
      jest.setSystemTime(renderTime);
      const view = render(<HabitDetail {...baseProps} />);

      // Simulate the user leaving the screen open for 5 minutes — well
      // past the 60s back-fill threshold.
      const clickTime = new Date(2025, 5, 15, 10, 5, 0);
      jest.setSystemTime(clickTime);

      fireEvent.press(view.getByText("Check-in"));

      const [called] = baseProps.onCheckInAt.mock.calls[0];
      expect((called as Date).getTime()).toBe(clickTime.getTime());
      expect((called as Date).getTime()).not.toBe(renderTime.getTime());
    });

    it("Skip uses fake-clock at click, not the rendered `now` prop", () => {
      const renderTime = sundayAt(10);
      jest.setSystemTime(renderTime);
      const view = render(<HabitDetail {...baseProps} showSkip={true} />);

      const clickTime = new Date(2025, 5, 15, 10, 5, 0);
      jest.setSystemTime(clickTime);

      fireEvent.press(view.getByText("Skip"));

      const [called] = baseProps.onSkipAt.mock.calls[0];
      expect((called as Date).getTime()).toBe(clickTime.getTime());
      expect((called as Date).getTime()).not.toBe(renderTime.getTime());
    });
  });
});
