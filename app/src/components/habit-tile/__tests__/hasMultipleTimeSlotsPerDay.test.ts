import type { ScheduleInfo } from "@nag/core";
import { hasMultipleTimeSlotsPerDay } from "../hasMultipleTimeSlotsPerDay";

const schedule = (days: number, hour = 8, minute = 0): ScheduleInfo => ({
  days,
  dayOfMonth: null,
  hour,
  minute,
});

// Day bitmask: bit 0 = Sunday … bit 6 = Saturday.
const MON = 1 << 1;
const WED = 1 << 3;
const FRI = 1 << 5;
const MON_WED_FRI = MON | WED | FRI;

describe("hasMultipleTimeSlotsPerDay", () => {
  it("returns false for an empty schedule list", () => {
    expect(hasMultipleTimeSlotsPerDay([])).toBe(false);
  });

  it("returns false for a single schedule on multiple days", () => {
    expect(hasMultipleTimeSlotsPerDay([schedule(MON_WED_FRI, 8)])).toBe(false);
  });

  it("returns false for several schedules on disjoint days", () => {
    expect(
      hasMultipleTimeSlotsPerDay([schedule(MON, 8), schedule(WED, 12)]),
    ).toBe(false);
  });

  it("returns true when two schedules cover the same day", () => {
    // 8am Mon/Wed/Fri AND 6pm Mon/Wed/Fri → multi-time-slot per day.
    expect(
      hasMultipleTimeSlotsPerDay([
        schedule(MON_WED_FRI, 8),
        schedule(MON_WED_FRI, 18),
      ]),
    ).toBe(true);
  });

  it("returns true when overlap is on a single day-of-week", () => {
    // 8am Mon/Wed AND 8am Wed/Fri → only Wed is doubled, but that's enough.
    expect(
      hasMultipleTimeSlotsPerDay([
        schedule(MON | WED, 8),
        schedule(WED | FRI, 9),
      ]),
    ).toBe(true);
  });

  it("treats a null days mask as no days", () => {
    expect(
      hasMultipleTimeSlotsPerDay([
        { days: null, dayOfMonth: null, hour: 8, minute: 0 },
        { days: null, dayOfMonth: null, hour: 9, minute: 0 },
      ]),
    ).toBe(false);
  });
});
