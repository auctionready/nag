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

  describe("greedy pairing", () => {
    it("pairs the first check-in with the first slot by time order", () => {
      const result = matchCheckInsToSlots({
        schedules: threePerDay,
        checkIns: [{ timestamp: sunday(13), skipped: false }],
        now: sunday(14),
      });
      expect(result.slots[0]?.status).toBe("done");
      expect(result.slots[0]?.hour).toBe(8);
      expect(result.slots[1]?.status).toBe("missed");
      expect(result.slots[2]?.status).toBe("upcoming");
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
