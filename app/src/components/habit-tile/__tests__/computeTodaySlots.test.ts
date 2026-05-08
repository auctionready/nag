import type { MatchCheckInsToSlotsResult, SlotState } from "@nag/core";
import type { Regularity } from "@nag/schema";
import {
  RECENT_MISS_WINDOW_MIN,
  computeTodaySlots,
  mapSlotStatus,
} from "../computeTodaySlots";

const at = (h: number, m = 0) => {
  const d = new Date(2026, 4, 3, h, m, 0);
  return d;
};

const slot = (
  hour: number,
  minute: number,
  status: SlotState["status"],
): SlotState => ({ hour, minute, status });

const matchResult = (
  slots: SlotState[],
  done = slots.filter((s) => s.status === "done").length,
): MatchCheckInsToSlotsResult => ({
  slots,
  extras: 0,
  done,
  total: slots.length,
});

const goal = (regularity: Regularity, frequency: number) => ({
  regularity,
  frequency,
});

describe("mapSlotStatus", () => {
  it("maps done slots to done", () => {
    expect(mapSlotStatus(slot(8, 0, "done"), at(12))).toBe("done");
  });

  it("treats skipped slots as done (user explicitly skipped)", () => {
    expect(mapSlotStatus(slot(8, 0, "skipped"), at(12))).toBe("done");
  });

  it("maps upcoming slots to pending", () => {
    expect(mapSlotStatus(slot(20, 0, "upcoming"), at(12))).toBe("pending");
  });

  it("maps a recently-missed slot (within window) to behind", () => {
    // slot at 11:00, now 12:00 → 60 min elapsed, within 90 min window.
    expect(mapSlotStatus(slot(11, 0, "missed"), at(12, 0))).toBe("behind");
  });

  it("maps a slot exactly at the window boundary as behind", () => {
    // slot at 10:30, now 12:00 → 90 min elapsed.
    expect(mapSlotStatus(slot(10, 30, "missed"), at(12, 0))).toBe("behind");
    expect(RECENT_MISS_WINDOW_MIN).toBe(90);
  });

  it("maps an older missed slot to missed", () => {
    // slot at 10:00, now 12:00 → 120 min elapsed.
    expect(mapSlotStatus(slot(10, 0, "missed"), at(12, 0))).toBe("missed");
  });
});

describe("computeTodaySlots", () => {
  describe("returns undefined", () => {
    it("when goal is null", () => {
      expect(computeTodaySlots(null, null, [], 0, at(12))).toBeUndefined();
    });

    it("for a single-slot scheduled habit", () => {
      const result = matchResult([slot(8, 0, "done")]);
      expect(
        computeTodaySlots(goal("week", 1), result, [], 1, at(12)),
      ).toBeUndefined();
    });

    it("for a daily habit with frequency 1", () => {
      expect(
        computeTodaySlots(goal("day", 1), null, [], 0, at(12)),
      ).toBeUndefined();
    });

    it("for a weekly habit with no scheduled slots today", () => {
      // total=0 with no matched slots — falls through; daily branch doesn't
      // apply because regularity is "week".
      const result = matchResult([]);
      expect(
        computeTodaySlots(goal("week", 3), result, [], 1, at(12)),
      ).toBeUndefined();
    });
  });

  describe("scheduled habits with multiple slots today", () => {
    it("maps each slot's status to a pip state", () => {
      const result = matchResult([
        slot(8, 0, "done"),
        slot(13, 0, "missed"),
        slot(20, 0, "upcoming"),
      ]);
      expect(
        computeTodaySlots(goal("week", 3), result, [], 3, at(13, 30)),
      ).toEqual(["done", "behind", "pending"]);
    });

    it("fades old missed slots to missed and recent ones to behind", () => {
      const result = matchResult([
        slot(8, 0, "missed"), // 4h elapsed → missed
        slot(11, 30, "missed"), // 30m elapsed → behind
      ]);
      expect(
        computeTodaySlots(goal("week", 2), result, [], 2, at(12, 0)),
      ).toEqual(["missed", "behind"]);
    });
  });

  describe("daily-frequency habits without schedules", () => {
    const todayCheckIn = (h: number) => ({ timestamp: at(h) });
    const yesterdayCheckIn = (h: number) => ({
      timestamp: new Date(2026, 4, 2, h, 0, 0),
    });

    it("emits all-pending when no check-ins today", () => {
      expect(computeTodaySlots(goal("day", 3), null, [], 0, at(12))).toEqual([
        "pending",
        "pending",
        "pending",
      ]);
    });

    it("emits one done per check-in, rest pending", () => {
      expect(
        computeTodaySlots(
          goal("day", 4),
          null,
          [todayCheckIn(8), todayCheckIn(10)],
          0,
          at(12),
        ),
      ).toEqual(["done", "done", "pending", "pending"]);
    });

    it("emits all done when count equals frequency", () => {
      expect(
        computeTodaySlots(
          goal("day", 2),
          null,
          [todayCheckIn(8), todayCheckIn(10)],
          0,
          at(12),
        ),
      ).toEqual(["done", "done"]);
    });

    it("appends ahead pips when count exceeds frequency", () => {
      expect(
        computeTodaySlots(
          goal("day", 2),
          null,
          [todayCheckIn(8), todayCheckIn(10), todayCheckIn(11)],
          0,
          at(12),
        ),
      ).toEqual(["done", "done", "ahead"]);
    });

    it("ignores check-ins from other days", () => {
      expect(
        computeTodaySlots(
          goal("day", 2),
          null,
          [yesterdayCheckIn(8), yesterdayCheckIn(20), todayCheckIn(10)],
          0,
          at(12),
        ),
      ).toEqual(["done", "pending"]);
    });

    it("does not synthesise pips for a daily habit that also has schedules", () => {
      // scheduleCount > 0 means schedules exist — slots branch handles it,
      // not the synthesis branch. With slots=null and scheduleCount=2, neither
      // branch fires.
      expect(
        computeTodaySlots(goal("day", 2), null, [todayCheckIn(8)], 2, at(12)),
      ).toBeUndefined();
    });
  });
});
