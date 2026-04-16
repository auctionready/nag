import { describe, expect, it } from "vitest";
import { matchCheckInsToSlots } from "../../trafficLight/matchCheckInsToSlots";
import type { ScheduleInfo } from "../../trafficLight";
import { Day } from "../../days";

// 2025-06-15 is a Sunday
const sunday = (h: number, m = 0) => new Date(2025, 5, 15, h, m);
const monday = (h: number, m = 0) => new Date(2025, 5, 16, h, m);
const yesterday = (h: number, m = 0) => new Date(2025, 5, 14, h, m);

const threePerDay: ScheduleInfo[] = [
  { days: null, dayOfMonth: null, hour: 12, minute: 0 },
  { days: null, dayOfMonth: null, hour: 8, minute: 0 },
  { days: null, dayOfMonth: null, hour: 18, minute: 0 },
];

describe("matchCheckInsToSlots", () => {
  describe("before any slot has elapsed", () => {
    it("returns all slots as upcoming", () => {
      const result = matchCheckInsToSlots({
        schedules: threePerDay,
        checkIns: [],
        now: sunday(7),
      });
      expect(result.slots.map((s) => s.status)).toEqual([
        "upcoming",
        "upcoming",
        "upcoming",
      ]);
      expect(result.total).toBe(3);
      expect(result.done).toBe(0);
      expect(result.extras).toBe(0);
    });

    it("sorts slots chronologically", () => {
      const result = matchCheckInsToSlots({
        schedules: threePerDay,
        checkIns: [],
        now: sunday(7),
      });
      expect(result.slots.map((s) => s.hour)).toEqual([8, 12, 18]);
    });
  });

  describe("nearest-slot pairing", () => {
    it("pairs a check-in with its closest slot by time-of-day", () => {
      // 1pm check-in is closer to noon (1h away) than to 8am (5h) or
      // 6pm (5h) — so the noon slot is the one marked done.
      const result = matchCheckInsToSlots({
        schedules: threePerDay,
        checkIns: [{ timestamp: sunday(13), skipped: false }],
        now: sunday(14),
      });
      expect(result.slots.map((s) => s.status)).toEqual([
        "missed",
        "done",
        "upcoming",
      ]);
      expect(result.slots[1]?.hour).toBe(12);
      expect(result.done).toBe(1);
    });

    it("marks a skipped check-in's matched slot as skipped", () => {
      const result = matchCheckInsToSlots({
        schedules: threePerDay,
        checkIns: [{ timestamp: sunday(9), skipped: true }],
        now: sunday(10),
      });
      expect(result.slots[0]?.status).toBe("skipped");
      expect(result.done).toBe(0);
    });

    it("fills all slots when there are enough check-ins", () => {
      const result = matchCheckInsToSlots({
        schedules: threePerDay,
        checkIns: [
          { timestamp: sunday(9), skipped: false },
          { timestamp: sunday(13), skipped: false },
          { timestamp: sunday(19), skipped: false },
        ],
        now: sunday(20),
      });
      expect(result.slots.map((s) => s.status)).toEqual([
        "done",
        "done",
        "done",
      ]);
      expect(result.done).toBe(3);
      expect(result.extras).toBe(0);
    });

    it("lands a back-filled last-slot check-in on the correct slot (not the first)", () => {
      // Regression: three scheduled slots (8am/1pm/9:30pm), user only
      // has a check-in for the 9:30pm slot. The back-fill sets
      // `timestamp` to the slot time, so nearest-match must put it on
      // 9:30pm — not shift it onto 8am by chronological index.
      const schedules: ScheduleInfo[] = [
        { days: null, dayOfMonth: null, hour: 8, minute: 0 },
        { days: null, dayOfMonth: null, hour: 13, minute: 0 },
        { days: null, dayOfMonth: null, hour: 21, minute: 30 },
      ];
      const result = matchCheckInsToSlots({
        schedules,
        checkIns: [{ timestamp: sunday(21, 30), skipped: false }],
        // End-of-day anchor — past slots read as "missed", not "upcoming".
        now: sunday(23, 59),
      });
      expect(result.slots.map((s) => s.status)).toEqual([
        "missed",
        "missed",
        "done",
      ]);
      expect(result.slots[2]?.hour).toBe(21);
      expect(result.slots[2]?.minute).toBe(30);
      expect(result.done).toBe(1);
    });

    it("survives removing a back-filled check-in from the middle", () => {
      // User back-filled 8am + 9:30pm; removes the 8am. The remaining
      // 9:30pm check-in must stay on the 9:30pm slot, not slide up to
      // 8am (as the old index-based pairing did).
      const schedules: ScheduleInfo[] = [
        { days: null, dayOfMonth: null, hour: 8, minute: 0 },
        { days: null, dayOfMonth: null, hour: 13, minute: 0 },
        { days: null, dayOfMonth: null, hour: 21, minute: 30 },
      ];
      const result = matchCheckInsToSlots({
        schedules,
        checkIns: [{ timestamp: sunday(21, 30), skipped: false }],
        now: sunday(23, 59),
      });
      expect(result.slots[0]?.status).toBe("missed");
      expect(result.slots[2]?.status).toBe("done");
    });
  });

  describe("extras", () => {
    it("reports check-ins beyond the number of slots", () => {
      const result = matchCheckInsToSlots({
        schedules: threePerDay,
        checkIns: [
          { timestamp: sunday(9), skipped: false },
          { timestamp: sunday(13), skipped: false },
          { timestamp: sunday(19), skipped: false },
          { timestamp: sunday(20), skipped: false },
          { timestamp: sunday(21), skipped: false },
        ],
        now: sunday(22),
      });
      expect(result.extras).toBe(2);
      expect(result.done).toBe(3);
    });
  });

  describe("filtering", () => {
    it("ignores schedules without an hour", () => {
      const result = matchCheckInsToSlots({
        schedules: [
          { days: null, dayOfMonth: null, hour: null, minute: null },
          { days: null, dayOfMonth: null, hour: 9, minute: 0 },
        ],
        now: sunday(10),
        checkIns: [],
      });
      expect(result.total).toBe(1);
    });

    it("ignores schedules whose day mask excludes today", () => {
      const schedules: ScheduleInfo[] = [
        {
          days: Day.Mon | Day.Wed | Day.Fri,
          dayOfMonth: null,
          hour: 9,
          minute: 0,
        },
      ];
      const sundayResult = matchCheckInsToSlots({
        schedules,
        checkIns: [],
        now: sunday(10),
      });
      expect(sundayResult.total).toBe(0);

      const mondayResult = matchCheckInsToSlots({
        schedules,
        checkIns: [],
        now: monday(10),
      });
      expect(mondayResult.total).toBe(1);
    });

    it("ignores check-ins from other days", () => {
      const result = matchCheckInsToSlots({
        schedules: threePerDay,
        checkIns: [{ timestamp: yesterday(9), skipped: false }],
        now: sunday(10),
      });
      expect(result.slots[0]?.status).toBe("missed");
      expect(result.done).toBe(0);
      expect(result.extras).toBe(0);
    });
  });

  it("includes matchedAt on done and skipped slots", () => {
    const at = sunday(9, 15);
    const result = matchCheckInsToSlots({
      schedules: threePerDay,
      checkIns: [{ timestamp: at, skipped: false }],
      now: sunday(10),
    });
    expect(result.slots[0]?.matchedAt).toEqual(at);
  });
});
