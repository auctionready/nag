import type { MatchCheckInsToTimeSlotsResult, TimeSlotState } from "@nag/core";
import type { Regularity } from "@nag/schema";
import {
  RECENT_MISS_WINDOW_MIN,
  computeTodayTimeSlots,
  mapTimeSlotStatus,
} from "../computeTodayTimeSlots";

const at = (h: number, m = 0) => {
  const d = new Date(2026, 4, 3, h, m, 0);
  return d;
};

const timeSlot = (
  hour: number,
  minute: number,
  status: TimeSlotState["status"],
): TimeSlotState => ({ hour, minute, status });

const matchResult = (
  timeSlots: TimeSlotState[],
  done = timeSlots.filter((s) => s.status === "done").length,
): MatchCheckInsToTimeSlotsResult => ({
  timeSlots,
  extras: 0,
  done,
  total: timeSlots.length,
});

const goal = (regularity: Regularity, frequency: number) => ({
  regularity,
  frequency,
});

describe("mapTimeSlotStatus", () => {
  it("maps done timeSlots to done", () => {
    expect(mapTimeSlotStatus(timeSlot(8, 0, "done"), at(12))).toBe("done");
  });

  it("treats skipped timeSlots as done (user explicitly skipped)", () => {
    expect(mapTimeSlotStatus(timeSlot(8, 0, "skipped"), at(12))).toBe("done");
  });

  it("maps upcoming timeSlots to pending", () => {
    expect(mapTimeSlotStatus(timeSlot(20, 0, "upcoming"), at(12))).toBe(
      "pending",
    );
  });

  it("maps a recently-missed timeSlot (within window) to behind", () => {
    // time-slot at 11:00, now 12:00 → 60 min elapsed, within 90 min window.
    expect(mapTimeSlotStatus(timeSlot(11, 0, "missed"), at(12, 0))).toBe(
      "behind",
    );
  });

  it("maps a timeSlot exactly at the window boundary as behind", () => {
    // time-slot at 10:30, now 12:00 → 90 min elapsed.
    expect(mapTimeSlotStatus(timeSlot(10, 30, "missed"), at(12, 0))).toBe(
      "behind",
    );
    expect(RECENT_MISS_WINDOW_MIN).toBe(90);
  });

  it("maps an older missed timeSlot to missed", () => {
    // time-slot at 10:00, now 12:00 → 120 min elapsed.
    expect(mapTimeSlotStatus(timeSlot(10, 0, "missed"), at(12, 0))).toBe(
      "missed",
    );
  });
});

describe("computeTodayTimeSlots", () => {
  describe("returns undefined", () => {
    it("when goal is null", () => {
      expect(computeTodayTimeSlots(null, null, [], 0, at(12))).toBeUndefined();
    });

    it("for a single-timeSlot scheduled habit", () => {
      const result = matchResult([timeSlot(8, 0, "done")]);
      expect(
        computeTodayTimeSlots(goal("week", 1), result, [], 1, at(12)),
      ).toBeUndefined();
    });

    it("for a daily habit with frequency 1", () => {
      expect(
        computeTodayTimeSlots(goal("day", 1), null, [], 0, at(12)),
      ).toBeUndefined();
    });

    it("for a weekly habit with no scheduled timeSlots today", () => {
      // total=0 with no matched time-slots — falls through; daily branch doesn't
      // apply because regularity is "week".
      const result = matchResult([]);
      expect(
        computeTodayTimeSlots(goal("week", 3), result, [], 1, at(12)),
      ).toBeUndefined();
    });
  });

  describe("scheduled habits with multiple timeSlots today", () => {
    it("maps each timeSlot's status to a pip state", () => {
      const result = matchResult([
        timeSlot(8, 0, "done"),
        timeSlot(13, 0, "missed"),
        timeSlot(20, 0, "upcoming"),
      ]);
      expect(
        computeTodayTimeSlots(goal("week", 3), result, [], 3, at(13, 30)),
      ).toEqual(["done", "behind", "pending"]);
    });

    it("fades old missed timeSlots to missed and recent ones to behind", () => {
      const result = matchResult([
        timeSlot(8, 0, "missed"), // 4h elapsed → missed
        timeSlot(11, 30, "missed"), // 30m elapsed → behind
      ]);
      expect(
        computeTodayTimeSlots(goal("week", 2), result, [], 2, at(12, 0)),
      ).toEqual(["missed", "behind"]);
    });
  });

  describe("daily-frequency habits without schedules", () => {
    const todayCheckIn = (h: number) => ({ timestamp: at(h) });
    const yesterdayCheckIn = (h: number) => ({
      timestamp: new Date(2026, 4, 2, h, 0, 0),
    });

    it("emits all-pending when no check-ins today", () => {
      expect(
        computeTodayTimeSlots(goal("day", 3), null, [], 0, at(12)),
      ).toEqual(["pending", "pending", "pending"]);
    });

    it("emits one done per check-in, rest pending", () => {
      expect(
        computeTodayTimeSlots(
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
        computeTodayTimeSlots(
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
        computeTodayTimeSlots(
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
        computeTodayTimeSlots(
          goal("day", 2),
          null,
          [yesterdayCheckIn(8), yesterdayCheckIn(20), todayCheckIn(10)],
          0,
          at(12),
        ),
      ).toEqual(["done", "pending"]);
    });

    it("does not synthesise pips for a daily habit that also has schedules", () => {
      // scheduleCount > 0 means schedules exist — time-slots branch handles it,
      // not the synthesis branch. With time-slots=null and scheduleCount=2, neither
      // branch fires.
      expect(
        computeTodayTimeSlots(
          goal("day", 2),
          null,
          [todayCheckIn(8)],
          2,
          at(12),
        ),
      ).toBeUndefined();
    });
  });
});
