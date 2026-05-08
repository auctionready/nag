import { describe, expect, it } from "vitest";
import { Day } from "../days";
import {
  habitProgressSnapshot,
  type HabitProgressInput,
} from "../habitProgressSnapshot";
import type { ComplianceColors, ScheduleInfo } from "../trafficLight";

const colors: ComplianceColors = {
  default: "#default",
  compliant: "#ok",
  partial: "#meh",
  failing: "#bad",
};

// Tuesday, 2025-06-03 14:00 local
const TUESDAY = new Date(2025, 5, 3, 14, 0);
// Wednesday, 2025-06-04 14:00 local
const WEDNESDAY = new Date(2025, 5, 4, 14, 0);
// Sunday, 2025-06-15 14:00 local
const SUNDAY = new Date(2025, 5, 15, 14, 0);

const timed = (days: number, hour: number, minute = 0): ScheduleInfo => ({
  days,
  dayOfMonth: null,
  hour,
  minute,
});

const base = (overrides: Partial<HabitProgressInput>): HabitProgressInput => ({
  goal: { frequency: 3, regularity: "week", createdAt: new Date(2020, 0, 1) },
  schedules: [],
  periodCheckIns: [],
  now: WEDNESDAY,
  colors,
  ...overrides,
});

describe("habitProgressSnapshot", () => {
  describe("anchorKind: none", () => {
    it("classifies missing goal + no schedules as none", () => {
      const snap = habitProgressSnapshot(base({ goal: null }));
      expect(snap.anchorKind).toBe("none");
      expect(snap.ring).toBe(0);
    });

    it("classifies zero-frequency goal + no schedules as none", () => {
      const snap = habitProgressSnapshot(
        base({
          goal: {
            frequency: 0,
            regularity: "week",
            createdAt: new Date(2020, 0, 1),
          },
        }),
      );
      expect(snap.anchorKind).toBe("none");
      expect(snap.ring).toBe(0);
    });

    it("scheduled-day classification works even without a goal", () => {
      const snap = habitProgressSnapshot(
        base({
          goal: null,
          schedules: [timed(Day.Mon | Day.Wed | Day.Fri, 8)],
          periodCheckIns: [{ timestamp: new Date(2025, 5, 4, 8, 5) }],
        }),
      );
      expect(snap.anchorKind).toBe("scheduled-day");
      expect(snap.ring).toBe(1);
    });
  });

  describe("anchorKind: frequency-only", () => {
    it("ring = count / frequency, clamped", () => {
      const snap = habitProgressSnapshot(
        base({
          schedules: [],
          periodCheckIns: [
            { timestamp: new Date(2025, 5, 2) },
            { timestamp: new Date(2025, 5, 4) },
          ],
        }),
      );
      expect(snap.anchorKind).toBe("frequency-only");
      expect(snap.ring).toBeCloseTo(2 / 3);
      expect(snap.headline.completed).toBe(2);
      expect(snap.headline.frequency).toBe(3);
    });

    it("ring clamped to 1 when count exceeds frequency", () => {
      const snap = habitProgressSnapshot(
        base({
          schedules: [],
          periodCheckIns: Array.from({ length: 5 }, (_, i) => ({
            timestamp: new Date(2025, 5, 2 + i),
          })),
        }),
      );
      expect(snap.ring).toBe(1);
    });

    it("uses periodCheckInCount when supplied", () => {
      const snap = habitProgressSnapshot(
        base({
          schedules: [],
          periodCheckIns: [{ timestamp: WEDNESDAY }],
          periodCheckInCount: 2,
        }),
      );
      expect(snap.headline.completed).toBe(2);
      expect(snap.ring).toBeCloseTo(2 / 3);
    });
  });

  describe("anchorKind: scheduled-day", () => {
    const schedules = [
      timed(Day.Mon | Day.Wed | Day.Fri, 8),
      timed(Day.Mon | Day.Wed | Day.Fri, 14),
      timed(Day.Mon | Day.Wed | Day.Fri, 20),
    ];

    it("ring = done / total with no extras", () => {
      const snap = habitProgressSnapshot(
        base({
          schedules,
          periodCheckIns: [
            { timestamp: new Date(2025, 5, 4, 8, 5) },
            { timestamp: new Date(2025, 5, 4, 14, 10) },
          ],
        }),
      );
      expect(snap.anchorKind).toBe("scheduled-day");
      expect(snap.ring).toBeCloseTo(2 / 3);
      expect(snap.headline.done).toBe(2);
      expect(snap.headline.total).toBe(3);
      expect(snap.headline.extras).toBe(0);
    });

    it("extras count in ring numerator and clamp to 1", () => {
      const snap = habitProgressSnapshot(
        base({
          schedules,
          periodCheckIns: [
            { timestamp: new Date(2025, 5, 4, 8, 5) },
            { timestamp: new Date(2025, 5, 4, 14, 5) },
            { timestamp: new Date(2025, 5, 4, 20, 5) },
            { timestamp: new Date(2025, 5, 4, 21, 0) },
          ],
        }),
      );
      expect(snap.ring).toBe(1);
      expect(snap.headline.extras).toBe(1);
    });

    it("ignores timed schedules whose day mask excludes the anchor", () => {
      const snap = habitProgressSnapshot(
        base({
          schedules: [timed(Day.Mon, 8), timed(Day.Wed, 14)],
          periodCheckIns: [{ timestamp: new Date(2025, 5, 4, 14, 0) }],
        }),
      );
      expect(snap.ring).toBe(1);
      expect(snap.headline.total).toBe(1);
    });
  });

  describe("anchorKind: off-day", () => {
    const schedules = [timed(Day.Mon | Day.Wed | Day.Fri, 8)];

    it("today is not a scheduled day (anchor = now = Tuesday)", () => {
      const snap = habitProgressSnapshot(base({ schedules, now: TUESDAY }));
      expect(snap.anchorKind).toBe("off-day");
      expect(snap.ring).toBe(0);
      expect(snap.isAnchorOffDay).toBe(true);
    });

    it("day-mask-only schedule is off-day on every anchor (no timed timeSlots)", () => {
      // Behaviour change: the old tile `computeRingProgress` used a
      // Math.ceil(frequency / popcount(mask)) fallback for day-mask-only
      // habits. The snapshot drops that; they now classify as off-day on
      // every day, matching what the detail screen already shows.
      const dayMaskOnly: ScheduleInfo = {
        days: Day.Mon | Day.Wed | Day.Fri,
        dayOfMonth: null,
        hour: null,
        minute: null,
      };
      const snap = habitProgressSnapshot(
        base({ schedules: [dayMaskOnly], now: WEDNESDAY }),
      );
      expect(snap.anchorKind).toBe("off-day");
      expect(snap.ring).toBe(0);
    });
  });

  describe("anchorColor", () => {
    it("undefined when anchor is not today", () => {
      const schedules = [timed(Day.Mon | Day.Wed | Day.Fri, 8)];
      const snap = habitProgressSnapshot(
        base({
          schedules,
          periodCheckIns: [{ timestamp: new Date(2025, 5, 2, 8, 0) }],
          now: WEDNESDAY,
          anchor: new Date(2025, 5, 2, 14, 0), // Monday, not today
        }),
      );
      expect(snap.anchorColor).toBeUndefined();
    });

    it("populated when anchor is today and a timeSlot has elapsed", () => {
      const schedules = [timed(Day.Mon | Day.Wed | Day.Fri, 8)];
      const snap = habitProgressSnapshot(
        base({
          schedules,
          periodCheckIns: [{ timestamp: new Date(2025, 5, 4, 8, 5) }],
          now: WEDNESDAY,
        }),
      );
      expect(snap.anchorColor).toBe(colors.compliant);
    });
  });

  describe("isAnchorOffDay", () => {
    it("only true when anchor is today AND habit has schedules AND today is off", () => {
      const schedules = [timed(Day.Mon | Day.Wed | Day.Fri, 8)];
      const todayOff = habitProgressSnapshot(
        base({ schedules, now: TUESDAY, anchor: TUESDAY }),
      );
      expect(todayOff.isAnchorOffDay).toBe(true);
    });

    it("false when the anchor is a non-today off-day (detail screen viewing past)", () => {
      const schedules = [timed(Day.Mon | Day.Wed | Day.Fri, 8)];
      const viewingPast = habitProgressSnapshot(
        base({
          schedules,
          now: WEDNESDAY,
          anchor: TUESDAY, // viewing Tue on a Wed `now`
        }),
      );
      expect(viewingPast.isAnchorOffDay).toBe(false);
    });
  });

  describe("day-of-week masks", () => {
    it("completedDaysMask covers days where every timeSlot is checked in", () => {
      const schedules = [
        timed(Day.Mon | Day.Wed, 8),
        timed(Day.Mon | Day.Wed, 14),
      ];
      const snap = habitProgressSnapshot(
        base({
          schedules,
          periodCheckIns: [
            { timestamp: new Date(2025, 5, 2, 8, 5) },
            { timestamp: new Date(2025, 5, 2, 14, 5) },
            { timestamp: new Date(2025, 5, 4, 8, 5) }, // Wed only has 1 of 2
          ],
        }),
      );
      expect(snap.completedDaysMask & Day.Mon).toBeTruthy();
      expect(snap.partialDaysMask & Day.Wed).toBeTruthy();
      expect(snap.completedDaysMask & Day.Wed).toBeFalsy();
    });

    it("unscheduledWeeklyMask lights up days with any check-in for weekly + no schedule", () => {
      const snap = habitProgressSnapshot(
        base({
          schedules: [],
          periodCheckIns: [
            { timestamp: new Date(2025, 5, 2, 9, 0) }, // Mon
            { timestamp: new Date(2025, 5, 4, 9, 0) }, // Wed
          ],
        }),
      );
      expect(snap.unscheduledWeeklyMask & Day.Mon).toBeTruthy();
      expect(snap.unscheduledWeeklyMask & Day.Wed).toBeTruthy();
      expect(snap.unscheduledWeeklyMask & Day.Tue).toBeFalsy();
    });

    it("unscheduledWeeklyMask is 0 for daily habits", () => {
      const snap = habitProgressSnapshot(
        base({
          goal: {
            frequency: 1,
            regularity: "day",
            createdAt: new Date(2020, 0, 1),
          },
          schedules: [],
          periodCheckIns: [{ timestamp: WEDNESDAY }],
        }),
      );
      expect(snap.unscheduledWeeklyMask).toBe(0);
    });
  });

  describe("Sunday-first regression (week-boundary bug fix)", () => {
    it("classifies a Sunday check-in against the Sunday bit (not shifted)", () => {
      // The detail screen's old weekly filter started the week on
      // Sunday via `start.setDate(start.getDate() - start.getDay())`,
      // which means a Sunday check-in landed at the START of the hand-
      // rolled window and still classified correctly. The actual bug is
      // more subtle: for a Mon-first period-scoped list, a Sunday
      // check-in for the current (Mon-first) week must still classify
      // into the Sunday bit of completedDaysMask. Verify that directly.
      const schedules = [timed(Day.Sun, 14)];
      const snap = habitProgressSnapshot(
        base({
          goal: {
            frequency: 1,
            regularity: "week",
            createdAt: new Date(2020, 0, 1),
          },
          schedules,
          periodCheckIns: [{ timestamp: new Date(2025, 5, 15, 14, 5) }],
          now: SUNDAY,
        }),
      );
      expect(snap.anchorKind).toBe("scheduled-day");
      expect(snap.completedDaysMask & Day.Sun).toBeTruthy();
      expect(snap.ring).toBe(1);
    });
  });

  describe("periodColor / periodProgress parity with tileColor", () => {
    it("periodColor reflects traffic-light compliant when fully met", () => {
      const snap = habitProgressSnapshot(
        base({
          goal: {
            frequency: 1,
            regularity: "day",
            createdAt: new Date(2020, 0, 1),
          },
          schedules: [],
          periodCheckIns: [{ timestamp: WEDNESDAY }],
        }),
      );
      expect(snap.periodColor).toBe(colors.compliant);
    });
  });
});
