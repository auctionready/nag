import { describe, it, expect, beforeEach } from "vitest";
import {
  overdueCountAt,
  buildBadgeTransitions,
  type BadgeInputs,
} from "../badgeSchedule";
import type { ScheduleInfo } from "../trafficLight/types";

// Every-day timed slot (days = 0 means "applies every day").
const slot = (hour: number, minute = 0): ScheduleInfo => ({
  days: 0,
  dayOfMonth: null,
  hour,
  minute,
});

const inputs = (
  schedules: Record<string, ScheduleInfo[]>,
  checkIns: Record<string, { timestamp: Date; skipped?: boolean }[]> = {},
): BadgeInputs => ({
  schedulesByHabit: new Map(Object.entries(schedules)),
  checkInsByHabit: new Map(Object.entries(checkIns)),
});

describe("overdueCountAt", () => {
  // Wed 2026-04-15.
  const day = (h: number, m = 0) => new Date(2026, 3, 15, h, m);

  it("counts a habit whose slot has elapsed unsatisfied", () => {
    const i = inputs({ a: [slot(8)] });
    expect(overdueCountAt(i, day(7))).toBe(0); // before 08:00
    expect(overdueCountAt(i, day(8))).toBe(1); // exactly 08:00 → elapsed
  });

  it("counts a habit once even with several missed slots", () => {
    const i = inputs({ a: [slot(8), slot(9), slot(10)] });
    expect(overdueCountAt(i, day(11))).toBe(1);
  });

  it("excludes a slot satisfied by a check-in", () => {
    const i = inputs({ a: [slot(8)] }, { a: [{ timestamp: day(8) }] });
    expect(overdueCountAt(i, day(9))).toBe(0);
  });

  it("excludes a skipped slot", () => {
    const i = inputs(
      { a: [slot(8)] },
      { a: [{ timestamp: day(8), skipped: true }] },
    );
    expect(overdueCountAt(i, day(9))).toBe(0);
  });

  it("sums across distinct habits", () => {
    const i = inputs({ a: [slot(8)], b: [slot(9)] });
    expect(overdueCountAt(i, day(9))).toBe(2);
  });
});

describe("buildBadgeTransitions", () => {
  const now = (h: number, m = 0) => new Date(2026, 3, 15, h, m);
  const at = (h: number, m = 0) => new Date(2026, 3, 15, h, m);
  const midnight = new Date(2026, 3, 16, 0, 0, 0, 0);

  beforeEach(() => {});

  it("emits a transition at each future slot and a midnight reset", () => {
    const i = inputs({ a: [slot(8)], b: [slot(12)] });
    const t = buildBadgeTransitions(i, now(6));
    expect(t).toEqual([
      { fireAt: at(8), badge: 1 },
      { fireAt: at(12), badge: 2 },
      { fireAt: midnight, badge: 0 },
    ]);
  });

  it("collapses consecutive equal counts (one habit, several slots)", () => {
    const i = inputs({ a: [slot(8), slot(9), slot(10)] });
    const t = buildBadgeTransitions(i, now(6));
    // Count goes 1 at 08:00 and stays 1 — only the first transition is emitted.
    expect(t).toEqual([
      { fireAt: at(8), badge: 1 },
      { fireAt: midnight, badge: 0 },
    ]);
  });

  it("excludes the current value and only schedules future changes", () => {
    // 08:00 already elapsed (badge already 1 'now'); only 12:00 is in future.
    const i = inputs({ a: [slot(8)], b: [slot(12)] });
    const t = buildBadgeTransitions(i, now(9));
    expect(t).toEqual([
      { fireAt: at(12), badge: 2 },
      { fireAt: midnight, badge: 0 },
    ]);
  });

  it("omits the midnight reset when nothing will be overdue today", () => {
    // Slot satisfied → never overdue → no reset needed.
    const i = inputs({ a: [slot(8)] }, { a: [{ timestamp: at(8) }] });
    expect(buildBadgeTransitions(i, now(6))).toEqual([]);
  });

  it("ignores slots scheduled only on other weekdays", () => {
    // 2026-04-15 is a Wednesday (day 3). A Monday-only slot must not count.
    const mondayOnly: ScheduleInfo = {
      days: 1 << 1,
      dayOfMonth: null,
      hour: 8,
      minute: 0,
    };
    const i = inputs({ a: [mondayOnly] });
    expect(buildBadgeTransitions(i, now(6))).toEqual([]);
  });
});
