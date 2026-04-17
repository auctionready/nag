import { beforeEach, describe, expect, it } from "vitest";
import {
  halfGapElapsed,
  hasLaterCheckIn,
  isBackfill,
  isFutureSlot,
  isPastDay,
  nextSlotAlreadyPassed,
} from "../../trafficLight/isBackfill";
import type { ScheduleInfo } from "../../trafficLight";

// 2025-06-15 is a Sunday.
const sunday = (h: number, m = 0) => new Date(2025, 5, 15, h, m);
const saturday = (h: number, m = 0) => new Date(2025, 5, 14, h, m);

const threePerDay: ScheduleInfo[] = [
  { days: null, dayOfMonth: null, hour: 8, minute: 0 },
  { days: null, dayOfMonth: null, hour: 12, minute: 0 },
  { days: null, dayOfMonth: null, hour: 18, minute: 0 },
];

const onlyMorningSlot: ScheduleInfo[] = [
  { days: null, dayOfMonth: null, hour: 8, minute: 0 },
];

// Two slots with a wide 12h gap — lets us exercise "later check-in"
// without halfGapElapsed spuriously firing.
const morningAndNight: ScheduleInfo[] = [
  { days: null, dayOfMonth: null, hour: 8, minute: 0 },
  { days: null, dayOfMonth: null, hour: 20, minute: 0 },
];

describe("isPastDay", () => {
  it("returns true when day is strictly before today", () => {
    expect(isPastDay(saturday(10), sunday(10))).toBe(true);
  });

  it("returns false when day is the same calendar day as now", () => {
    expect(isPastDay(sunday(0), sunday(23))).toBe(false);
  });

  it("returns false when day is after today", () => {
    expect(isPastDay(sunday(10), saturday(10))).toBe(false);
  });
});

describe("isFutureSlot", () => {
  it("returns true when the slot timestamp is after now", () => {
    expect(isFutureSlot(sunday(12), sunday(10))).toBe(true);
  });

  it("returns false when the slot timestamp is before now", () => {
    expect(isFutureSlot(sunday(8), sunday(10))).toBe(false);
  });

  it("returns false when the slot timestamp equals now", () => {
    expect(isFutureSlot(sunday(10), sunday(10))).toBe(false);
  });
});

describe("hasLaterCheckIn", () => {
  it("returns true when a same-day check-in is timestamped after the slot", () => {
    expect(hasLaterCheckIn(sunday(8), [{ timestamp: sunday(9) }])).toBe(true);
  });

  it("returns false when all same-day check-ins are earlier than the slot", () => {
    expect(hasLaterCheckIn(sunday(12), [{ timestamp: sunday(8) }])).toBe(false);
  });

  it("ignores later check-ins on a different calendar day", () => {
    expect(hasLaterCheckIn(sunday(8), [{ timestamp: saturday(23) }])).toBe(
      false,
    );
  });

  it("returns false when there are no check-ins", () => {
    expect(hasLaterCheckIn(sunday(8), [])).toBe(false);
  });
});

describe("nextSlotAlreadyPassed", () => {
  it("returns true when the next scheduled slot today is also in the past", () => {
    // Slot 8 AM, next is 12 PM, now is 2 PM → 12 PM has passed.
    expect(
      nextSlotAlreadyPassed(
        { hour: 8, minute: 0 },
        threePerDay,
        sunday(14),
        sunday(14),
      ),
    ).toBe(true);
  });

  it("returns false when the next scheduled slot is still upcoming", () => {
    // Slot 8 AM, next is 12 PM, now is 10 AM → 12 PM still upcoming.
    expect(
      nextSlotAlreadyPassed(
        { hour: 8, minute: 0 },
        threePerDay,
        sunday(10),
        sunday(10),
      ),
    ).toBe(false);
  });

  it("returns false when this slot is the last of the day", () => {
    // No next slot after 6 PM → rule cannot fire.
    expect(
      nextSlotAlreadyPassed(
        { hour: 18, minute: 0 },
        threePerDay,
        sunday(23),
        sunday(23),
      ),
    ).toBe(false);
  });
});

describe("halfGapElapsed", () => {
  it("returns true when elapsed exceeds half the gap to the next slot", () => {
    // 8→12 = 4h gap, half = 2h. Now 11 AM → elapsed 3h > 2h.
    expect(
      halfGapElapsed(
        { hour: 8, minute: 0 },
        threePerDay,
        sunday(11),
        sunday(11),
      ),
    ).toBe(true);
  });

  it("returns false when elapsed is within half the gap to the next slot", () => {
    // Now 9 AM → elapsed 1h < 2h.
    expect(
      halfGapElapsed({ hour: 8, minute: 0 }, threePerDay, sunday(9), sunday(9)),
    ).toBe(false);
  });

  it("returns false when the slot has not yet elapsed", () => {
    expect(
      halfGapElapsed(
        { hour: 12, minute: 0 },
        threePerDay,
        sunday(10),
        sunday(10),
      ),
    ).toBe(false);
  });

  describe("no next slot today (30-minute fallback)", () => {
    it("returns false when the slot passed less than 30 minutes ago", () => {
      // Only slot today is 8 AM; now 8:20 → elapsed 20 min < 30 min.
      expect(
        halfGapElapsed(
          { hour: 8, minute: 0 },
          onlyMorningSlot,
          sunday(8, 20),
          sunday(8, 20),
        ),
      ).toBe(false);
    });

    it("returns true when the slot passed more than 30 minutes ago", () => {
      // Only slot today is 8 AM; now 8:40 → elapsed 40 min > 30 min.
      expect(
        halfGapElapsed(
          { hour: 8, minute: 0 },
          onlyMorningSlot,
          sunday(8, 40),
          sunday(8, 40),
        ),
      ).toBe(true);
    });
  });
});

describe("isBackfill", () => {
  describe("rule: past day", () => {
    it("returns true for a slot on yesterday", () => {
      expect(
        isBackfill({
          slot: { hour: 8, minute: 0 },
          day: saturday(0),
          schedules: threePerDay,
          checkIns: [],
          now: sunday(10),
        }),
      ).toBe(true);
    });

    it("returns true for a past day even when wall-clock time would be upcoming", () => {
      // Slot is at 15:00 yesterday; now is 10:00 today. Without the
      // past-day short-circuit, the "future slot" check would fire on
      // the wall-clock time alone.
      expect(
        isBackfill({
          slot: { hour: 15, minute: 0 },
          day: saturday(0),
          schedules: threePerDay,
          checkIns: [],
          now: sunday(10),
        }),
      ).toBe(true);
    });
  });

  describe("rule: future slot on today", () => {
    it("returns false for a slot later today", () => {
      expect(
        isBackfill({
          slot: { hour: 18, minute: 0 },
          day: sunday(10),
          schedules: threePerDay,
          checkIns: [],
          now: sunday(10),
        }),
      ).toBe(false);
    });

    it("returns false even when an earlier check-in was logged", () => {
      // An earlier check-in must NOT make an upcoming slot look like a
      // back-fill — the slot still hasn't happened yet.
      expect(
        isBackfill({
          slot: { hour: 18, minute: 0 },
          day: sunday(10),
          schedules: threePerDay,
          checkIns: [{ timestamp: sunday(9) }],
          now: sunday(10),
        }),
      ).toBe(false);
    });
  });

  describe("rule: later check-in exists", () => {
    let args: {
      slot: { hour: number; minute: number };
      day: Date;
      schedules: ScheduleInfo[];
      checkIns: { timestamp: Date }[];
      now: Date;
    };

    beforeEach(() => {
      // Slot just passed (8 AM, now 8:05). Wide schedule so the
      // half-gap and next-slot-passed rules don't fire on their own.
      args = {
        slot: { hour: 8, minute: 0 },
        day: sunday(0),
        schedules: morningAndNight,
        checkIns: [],
        now: sunday(8, 5),
      };
    });

    it("returns true when a same-day check-in has a later timestamp", () => {
      expect(
        isBackfill({ ...args, checkIns: [{ timestamp: sunday(8, 3) }] }),
      ).toBe(true);
    });

    it("returns false when the only check-in is earlier than the slot", () => {
      expect(
        isBackfill({ ...args, checkIns: [{ timestamp: sunday(7, 50) }] }),
      ).toBe(false);
    });
  });

  describe("rule: next scheduled slot has already passed", () => {
    it("returns true when the next slot today is also in the past", () => {
      // Slot 8 AM, next 12 PM, now 14:00 → 12 PM has passed.
      expect(
        isBackfill({
          slot: { hour: 8, minute: 0 },
          day: sunday(0),
          schedules: threePerDay,
          checkIns: [],
          now: sunday(14),
        }),
      ).toBe(true);
    });

    it("returns false when the next slot is still upcoming", () => {
      // Slot 8 AM, now 8:30, next slot 20:00 → next still upcoming and
      // only 30 min of a 12h gap has elapsed, so no rule fires.
      expect(
        isBackfill({
          slot: { hour: 8, minute: 0 },
          day: sunday(0),
          schedules: morningAndNight,
          checkIns: [],
          now: sunday(8, 30),
        }),
      ).toBe(false);
    });
  });

  describe("rule: half-gap elapsed", () => {
    it("returns true when elapsed exceeds half the gap to the next slot", () => {
      // 8→12 gap = 4h, half = 2h. Now 11 AM → elapsed 3h > 2h. Next
      // slot (12) is still upcoming, so this rule fires in isolation.
      expect(
        isBackfill({
          slot: { hour: 8, minute: 0 },
          day: sunday(0),
          schedules: threePerDay,
          checkIns: [],
          now: sunday(11),
        }),
      ).toBe(true);
    });

    it("returns false when elapsed is within half the gap", () => {
      // Now 9 AM → elapsed 1h < 2h.
      expect(
        isBackfill({
          slot: { hour: 8, minute: 0 },
          day: sunday(0),
          schedules: threePerDay,
          checkIns: [],
          now: sunday(9),
        }),
      ).toBe(false);
    });
  });

  describe("rule: no next slot today (30-minute fallback)", () => {
    it("returns false when the slot passed less than 30 minutes ago", () => {
      expect(
        isBackfill({
          slot: { hour: 8, minute: 0 },
          day: sunday(0),
          schedules: onlyMorningSlot,
          checkIns: [],
          now: sunday(8, 20),
        }),
      ).toBe(false);
    });

    it("returns true when the slot passed more than 30 minutes ago", () => {
      expect(
        isBackfill({
          slot: { hour: 8, minute: 0 },
          day: sunday(0),
          schedules: onlyMorningSlot,
          checkIns: [],
          now: sunday(8, 40),
        }),
      ).toBe(true);
    });
  });

  describe("composition", () => {
    it("returns false on the 'just passed, nothing newer' happy path", () => {
      // Slot 8 AM just passed (now 8:05), no later check-in, next slot
      // far away, half-gap not elapsed → ordinary check-in.
      expect(
        isBackfill({
          slot: { hour: 8, minute: 0 },
          day: sunday(0),
          schedules: morningAndNight,
          checkIns: [],
          now: sunday(8, 5),
        }),
      ).toBe(false);
    });

    it("returns true when multiple rules apply simultaneously", () => {
      // Slot 8 AM, now 14:00: next slot passed AND half-gap elapsed AND
      // a later check-in exists.
      expect(
        isBackfill({
          slot: { hour: 8, minute: 0 },
          day: sunday(0),
          schedules: threePerDay,
          checkIns: [{ timestamp: sunday(13) }],
          now: sunday(14),
        }),
      ).toBe(true);
    });
  });
});
