import { describe, expect, it } from "vitest";
import {
  agendaCheckInTime,
  buildDayAgenda,
  createGetDayAgenda,
} from "../dayAgenda";
import { Day } from "../days";

// 2026-05-02 is Saturday — matches the design's "today" frame
const today = (h = 13, m = 0) => new Date(2026, 4, 2, h, m);
const yesterday = (h = 13, m = 0) => new Date(2026, 4, 1, h, m);
const tomorrow = (h = 13, m = 0) => new Date(2026, 4, 3, h, m);

describe("buildDayAgenda", () => {
  describe("today", () => {
    it("marks past slot without check-in as overdue", () => {
      const result = buildDayAgenda({
        schedules: [{ days: 0, dayOfMonth: null, hour: 9, minute: 0 }],
        checkIns: [],
        day: today(),
        now: today(13),
      });
      expect(result.mode).toBe("today");
      expect(result.slots).toEqual([{ hour: 9, minute: 0, status: "overdue" }]);
    });

    it("marks future slot as upcoming", () => {
      const result = buildDayAgenda({
        schedules: [{ days: 0, dayOfMonth: null, hour: 20, minute: 0 }],
        checkIns: [],
        day: today(),
        now: today(13),
      });
      expect(result.slots[0].status).toBe("upcoming");
    });

    it("matches a check-in to its nearest slot as done", () => {
      const result = buildDayAgenda({
        schedules: [{ days: 0, dayOfMonth: null, hour: 8, minute: 0 }],
        checkIns: [{ timestamp: today(8, 4), skipped: false }],
        day: today(),
        now: today(13),
      });
      expect(result.slots[0].status).toBe("done");
      expect(result.slots[0].matchedAt).toEqual(today(8, 4));
    });

    it("treats skipped check-ins as skip status", () => {
      const result = buildDayAgenda({
        schedules: [{ days: 0, dayOfMonth: null, hour: 13, minute: 30 }],
        checkIns: [{ timestamp: today(13, 30), skipped: true }],
        day: today(),
        now: today(14),
      });
      expect(result.slots[0].status).toBe("skip");
    });

    it("returns extras for check-ins without a slot to claim", () => {
      const result = buildDayAgenda({
        schedules: [],
        checkIns: [{ timestamp: today(10, 0), skipped: false }],
        day: today(),
        now: today(13),
      });
      expect(result.slots).toEqual([]);
      expect(result.extras).toEqual([
        { timestamp: today(10, 0), skipped: false },
      ]);
    });

    it("ignores slots not scheduled on the target weekday", () => {
      // Today is Saturday; schedule only Mon
      const result = buildDayAgenda({
        schedules: [{ days: Day.Mon, dayOfMonth: null, hour: 9, minute: 0 }],
        checkIns: [],
        day: today(),
        now: today(13),
      });
      expect(result.slots).toEqual([]);
    });
  });

  describe("past day", () => {
    it("marks unmatched slot as missed", () => {
      const result = buildDayAgenda({
        schedules: [{ days: 0, dayOfMonth: null, hour: 9, minute: 0 }],
        checkIns: [],
        day: yesterday(),
        now: today(13),
      });
      expect(result.mode).toBe("past");
      expect(result.slots[0].status).toBe("missed");
    });

    it("matched slot remains done", () => {
      const result = buildDayAgenda({
        schedules: [{ days: 0, dayOfMonth: null, hour: 8, minute: 0 }],
        checkIns: [{ timestamp: yesterday(8, 1), skipped: false }],
        day: yesterday(),
        now: today(13),
      });
      expect(result.slots[0].status).toBe("done");
    });
  });

  describe("future day", () => {
    it("marks every slot as scheduled", () => {
      const result = buildDayAgenda({
        schedules: [
          { days: 0, dayOfMonth: null, hour: 7, minute: 0 },
          { days: 0, dayOfMonth: null, hour: 20, minute: 0 },
        ],
        checkIns: [],
        day: tomorrow(),
        now: today(13),
      });
      expect(result.mode).toBe("future");
      expect(result.slots.map((s) => s.status)).toEqual([
        "scheduled",
        "scheduled",
      ]);
    });
  });
});

describe("createGetDayAgenda", () => {
  const pill = { id: "pill", title: "Pain pill", icon: "pill" };
  const water = { id: "water", title: "Water", icon: "water" };

  it("flattens slots and extras across every habit", () => {
    const getDayAgenda = createGetDayAgenda({
      habits: [pill, water],
      schedulesByHabit: new Map([
        ["pill", [{ days: 0, dayOfMonth: null, hour: 8, minute: 0 }]],
        ["water", []],
      ]),
      checkInsByHabit: new Map([
        ["pill", [{ id: "ci-1", timestamp: today(8, 2), skipped: false }]],
        ["water", [{ id: "ci-2", timestamp: today(10, 0), skipped: false }]],
      ]),
    });
    const agenda = getDayAgenda(today(), today(13));
    expect(agenda.mode).toBe("today");
    expect(agenda.items).toHaveLength(2);
    const pillItem = agenda.items.find((i) => i.habitId === "pill")!;
    expect(pillItem.status).toBe("done");
    expect(pillItem.checkInId).toBe("ci-1");
    expect(pillItem.slotHour).toBe(8);
    const waterItem = agenda.items.find((i) => i.habitId === "water")!;
    expect(waterItem.status).toBe("done");
    expect(waterItem.checkInId).toBe("ci-2");
    expect(waterItem.slotHour).toBeUndefined();
  });

  it("uses habit metadata for title and icon", () => {
    const getDayAgenda = createGetDayAgenda({
      habits: [pill],
      schedulesByHabit: new Map([
        ["pill", [{ days: 0, dayOfMonth: null, hour: 8, minute: 0 }]],
      ]),
      checkInsByHabit: new Map(),
    });
    const agenda = getDayAgenda(today(), today(13));
    expect(agenda.items[0]).toMatchObject({
      habitTitle: "Pain pill",
      habitIcon: "pill",
      status: "overdue",
    });
  });

  it("emits stable, unique keys per habit and slot", () => {
    const getDayAgenda = createGetDayAgenda({
      habits: [pill, water],
      schedulesByHabit: new Map([
        [
          "pill",
          [
            { days: 0, dayOfMonth: null, hour: 8, minute: 0 },
            { days: 0, dayOfMonth: null, hour: 20, minute: 0 },
          ],
        ],
        ["water", []],
      ]),
      checkInsByHabit: new Map([
        ["water", [{ id: "ci-x", timestamp: today(10, 0), skipped: false }]],
      ]),
    });
    const agenda = getDayAgenda(today(), today(13));
    const keys = agenda.items.map((i) => i.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toContain("pill::slot::0");
    expect(keys).toContain("pill::slot::1");
    expect(keys).toContain("water::extra::0");
  });

  it("carries skipped check-ins through as skip with their id", () => {
    const getDayAgenda = createGetDayAgenda({
      habits: [pill],
      schedulesByHabit: new Map([
        ["pill", [{ days: 0, dayOfMonth: null, hour: 8, minute: 0 }]],
      ]),
      checkInsByHabit: new Map([
        ["pill", [{ id: "ci-skip", timestamp: today(8, 0), skipped: true }]],
      ]),
    });
    const agenda = getDayAgenda(today(), today(13));
    expect(agenda.items[0]).toMatchObject({
      status: "skip",
      checkInId: "ci-skip",
    });
  });

  it("orders a habit's scheduled slots before its extras", () => {
    const getDayAgenda = createGetDayAgenda({
      habits: [pill],
      schedulesByHabit: new Map([
        ["pill", [{ days: 0, dayOfMonth: null, hour: 8, minute: 0 }]],
      ]),
      checkInsByHabit: new Map([
        [
          "pill",
          [
            { id: "ci-slot", timestamp: today(8, 1), skipped: false },
            { id: "ci-extra", timestamp: today(15, 0), skipped: false },
          ],
        ],
      ]),
    });
    const agenda = getDayAgenda(today(), today(16));
    expect(agenda.items.map((i) => i.key)).toEqual([
      "pill::slot::0",
      "pill::extra::0",
    ]);
    expect(agenda.items[1].checkInId).toBe("ci-extra");
  });

  it("keeps habits in input order", () => {
    const getDayAgenda = createGetDayAgenda({
      habits: [water, pill],
      schedulesByHabit: new Map([
        ["pill", [{ days: 0, dayOfMonth: null, hour: 8, minute: 0 }]],
        ["water", [{ days: 0, dayOfMonth: null, hour: 9, minute: 0 }]],
      ]),
      checkInsByHabit: new Map(),
    });
    const agenda = getDayAgenda(today(), today(13));
    expect(agenda.items.map((i) => i.habitId)).toEqual(["water", "pill"]);
  });

  it("returns an empty agenda when there are no habits", () => {
    const getDayAgenda = createGetDayAgenda({
      habits: [],
      schedulesByHabit: new Map(),
      checkInsByHabit: new Map(),
    });
    const agenda = getDayAgenda(today(), today(13));
    expect(agenda.items).toEqual([]);
    // No habits means mode can't be derived; defaults to the live day.
    expect(agenda.mode).toBe("today");
  });

  describe("mode reflects the queried day, not now", () => {
    const lookups = {
      habits: [pill],
      schedulesByHabit: new Map([
        ["pill", [{ days: 0, dayOfMonth: null, hour: 8, minute: 0 }]],
      ]),
      checkInsByHabit: new Map(),
    };

    it("marks a past day's unmatched slot as missed", () => {
      const agenda = createGetDayAgenda(lookups)(yesterday(), today(13));
      expect(agenda.mode).toBe("past");
      expect(agenda.items[0].status).toBe("missed");
    });

    it("marks a future day's slot as scheduled", () => {
      const agenda = createGetDayAgenda(lookups)(tomorrow(), today(13));
      expect(agenda.mode).toBe("future");
      expect(agenda.items[0].status).toBe("scheduled");
    });
  });

  it("can be reused across days and times from one factory instance", () => {
    const getDayAgenda = createGetDayAgenda({
      habits: [pill],
      schedulesByHabit: new Map([
        ["pill", [{ days: 0, dayOfMonth: null, hour: 12, minute: 0 }]],
      ]),
      checkInsByHabit: new Map(),
    });
    // Same instance, different `now`: noon slot flips overdue → upcoming
    // depending on the wall-clock time passed in.
    expect(getDayAgenda(today(), today(13)).items[0].status).toBe("overdue");
    expect(getDayAgenda(today(), today(9)).items[0].status).toBe("upcoming");
    // And a different day yields a different mode.
    expect(getDayAgenda(tomorrow(), today(13)).mode).toBe("future");
  });
});

describe("agendaCheckInTime", () => {
  it("records a slotted item at its deemed slot time, not now", () => {
    const ts = agendaCheckInTime(
      { slotHour: 9, slotMinute: 0 },
      today(),
      today(12, 30),
    );
    expect(ts).toEqual(today(9, 0));
  });

  it("records a slotless item at now", () => {
    const now = today(12, 30);
    const ts = agendaCheckInTime({}, today(), now);
    expect(ts).toBe(now);
  });

  it("anchors the slot time to the agenda's day, not now's day", () => {
    const ts = agendaCheckInTime(
      { slotHour: 8, slotMinute: 0 },
      yesterday(),
      today(12, 30),
    );
    expect(ts).toEqual(yesterday(8, 0));
  });

  // Regression: a habit with an earlier overdue slot and a later upcoming
  // slot. Checking in the overdue slot must mark *it* done — not the later
  // one. buildDayAgenda pairs by nearest time, so the recording timestamp
  // decides which slot the new check-in lands on.
  describe("checking an overdue slot with a later slot in the same day", () => {
    const schedules = [
      { days: 0, dayOfMonth: null, hour: 8, minute: 0 },
      { days: 0, dayOfMonth: null, hour: 13, minute: 0 },
    ];
    // 12:30 — past the 8am slot (overdue), before the 1pm slot (upcoming).
    const now = today(12, 30);

    it("baseline: 8am overdue, 1pm upcoming", () => {
      const { slots } = buildDayAgenda({
        schedules,
        checkIns: [],
        day: today(),
        now,
      });
      expect(slots.map((s) => s.status)).toEqual(["overdue", "upcoming"]);
    });

    it("recording at the deemed slot time marks the overdue slot done", () => {
      const ts = agendaCheckInTime(
        { slotHour: 8, slotMinute: 0 },
        today(),
        now,
      );
      const { slots } = buildDayAgenda({
        schedules,
        checkIns: [{ timestamp: ts, skipped: false }],
        day: today(),
        now,
      });
      expect(slots.map((s) => s.status)).toEqual(["done", "upcoming"]);
    });

    it("recording at now would mis-pair to the nearer 1pm slot (the bug)", () => {
      const { slots } = buildDayAgenda({
        schedules,
        checkIns: [{ timestamp: now, skipped: false }],
        day: today(),
        now,
      });
      // 12:30 is nearer 1pm than 8am, so the check-in lands on the wrong slot.
      expect(slots.map((s) => s.status)).toEqual(["overdue", "done"]);
    });
  });
});
