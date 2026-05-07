import { describe, it, expect, beforeEach } from "vitest";
import * as schema from "@nag/schema";
import {
  allHabits,
  habitById,
  goalForHabitFull,
  checkInsForHabit,
  checkInsForHabitsOnDay,
  calendarCheckIns,
  goalForHabit,
  checkInCount,
  recentCheckIns,
  checkInsInPeriod,
  schedulesForGoal,
  schedulesForHabits,
  habitsByIds,
} from "../queries";
import { subDays } from "date-fns";
import { setupTestDb } from "./testDb";

const getDb = setupTestDb("core-test.db");

describe("goalForHabit", () => {
  it("returns the goal for a habit", async () => {
    const db = getDb();
    const [h] = await db
      .insert(schema.habit)
      .values({ id: crypto.randomUUID(), title: "Test" })
      .returning();
    await db
      .insert(schema.goal)
      .values({ habitId: h.id, regularity: "day", frequency: 3 });

    const goals = await goalForHabit(db, h.id);
    expect(goals).toHaveLength(1);
    expect(goals[0].frequency).toBe(3);
    expect(goals[0].regularity).toBe("day");
    expect(goals[0].createdAt).toBeInstanceOf(Date);
  });

  it("returns empty when no goal exists", async () => {
    const db = getDb();
    const [h] = await db
      .insert(schema.habit)
      .values({ id: crypto.randomUUID(), title: "No goal" })
      .returning();
    const goals = await goalForHabit(db, h.id);
    expect(goals).toHaveLength(0);
  });
});

describe("checkInCount", () => {
  it("counts all check-ins for a habit", async () => {
    const db = getDb();
    const [h] = await db
      .insert(schema.habit)
      .values({ id: crypto.randomUUID(), title: "Count" })
      .returning();
    await db
      .insert(schema.checkIn)
      .values({ id: crypto.randomUUID(), habitId: h.id });
    await db
      .insert(schema.checkIn)
      .values({ id: crypto.randomUUID(), habitId: h.id });

    const [row] = await checkInCount(db, h.id);
    expect(row.value).toBe(2);
  });

  it("counts only check-ins since a date", async () => {
    const db = getDb();
    const [h] = await db
      .insert(schema.habit)
      .values({ id: crypto.randomUUID(), title: "Since" })
      .returning();
    const old = subDays(new Date(), 5);
    const recent = new Date();
    await db
      .insert(schema.checkIn)
      .values({ id: crypto.randomUUID(), habitId: h.id, timestamp: old });
    await db
      .insert(schema.checkIn)
      .values({ id: crypto.randomUUID(), habitId: h.id, timestamp: recent });

    const since = subDays(new Date(), 1);
    const [row] = await checkInCount(db, h.id, since);
    expect(row.value).toBe(1);
  });
});

describe("recentCheckIns", () => {
  it("returns check-ins in descending order", async () => {
    const db = getDb();
    const [h] = await db
      .insert(schema.habit)
      .values({ id: crypto.randomUUID(), title: "Recent" })
      .returning();
    const t1 = subDays(new Date(), 3);
    const t2 = subDays(new Date(), 1);
    const t3 = new Date();
    await db
      .insert(schema.checkIn)
      .values({ id: crypto.randomUUID(), habitId: h.id, timestamp: t1 });
    await db
      .insert(schema.checkIn)
      .values({ id: crypto.randomUUID(), habitId: h.id, timestamp: t2 });
    await db
      .insert(schema.checkIn)
      .values({ id: crypto.randomUUID(), habitId: h.id, timestamp: t3 });

    const rows = await recentCheckIns(db, h.id);
    expect(rows).toHaveLength(3);
    expect(rows[0].timestamp.getTime()).toBeGreaterThan(
      rows[1].timestamp.getTime(),
    );
    expect(rows[1].timestamp.getTime()).toBeGreaterThan(
      rows[2].timestamp.getTime(),
    );
  });

  it("respects limit", async () => {
    const db = getDb();
    const [h] = await db
      .insert(schema.habit)
      .values({ id: crypto.randomUUID(), title: "Limit" })
      .returning();
    for (let i = 0; i < 5; i++) {
      await db
        .insert(schema.checkIn)
        .values({ id: crypto.randomUUID(), habitId: h.id });
    }

    const rows = await recentCheckIns(db, h.id, undefined, 2);
    expect(rows).toHaveLength(2);
  });
});

describe("checkInsInPeriod", () => {
  it("returns every check-in since `since` with no limit", async () => {
    const db = getDb();
    const [h] = await db
      .insert(schema.habit)
      .values({ id: crypto.randomUUID(), title: "Period" })
      .returning();
    // Insert 10 check-ins this period — more than `recentCheckIns`'s
    // historical default limits (3/7) — to confirm there's no truncation.
    const since = subDays(new Date(), 7);
    for (let i = 0; i < 10; i++) {
      await db.insert(schema.checkIn).values({
        id: crypto.randomUUID(),
        habitId: h.id,
        timestamp: subDays(new Date(), i % 7),
      });
    }
    const rows = await checkInsInPeriod(db, h.id, since);
    expect(rows).toHaveLength(10);
  });

  it("filters out check-ins before `since`", async () => {
    const db = getDb();
    const [h] = await db
      .insert(schema.habit)
      .values({ id: crypto.randomUUID(), title: "Bounded" })
      .returning();
    await db.insert(schema.checkIn).values({
      id: crypto.randomUUID(),
      habitId: h.id,
      timestamp: subDays(new Date(), 30),
    });
    await db.insert(schema.checkIn).values({
      id: crypto.randomUUID(),
      habitId: h.id,
      timestamp: subDays(new Date(), 1),
    });
    const rows = await checkInsInPeriod(db, h.id, subDays(new Date(), 7));
    expect(rows).toHaveLength(1);
  });

  it("includes back-filled check-ins regardless of insert order", async () => {
    // Repro for the home-board / habit-detail discrepancy: after a
    // back-fill, the deemed `timestamp` is in the past but `created_at`
    // is now. The query must order by `timestamp` (not creation order)
    // and must not silently drop back-fills.
    const db = getDb();
    const [h] = await db
      .insert(schema.habit)
      .values({ id: crypto.randomUUID(), title: "Back-fill" })
      .returning();
    // Today's "real" check-in first.
    await db
      .insert(schema.checkIn)
      .values({ id: crypto.randomUUID(), habitId: h.id });
    // Then a back-fill for 3 days ago (deemed time = past).
    await db.insert(schema.checkIn).values({
      id: crypto.randomUUID(),
      habitId: h.id,
      timestamp: subDays(new Date(), 3),
    });
    const rows = await checkInsInPeriod(db, h.id, subDays(new Date(), 7));
    expect(rows).toHaveLength(2);
    // Newest deemed-time first (back-fill comes after today's check-in).
    expect(rows[0].timestamp.getTime()).toBeGreaterThan(
      rows[1].timestamp.getTime(),
    );
  });
});

describe("allHabits", () => {
  it("returns all habits", async () => {
    const db = getDb();
    await db
      .insert(schema.habit)
      .values({ id: crypto.randomUUID(), title: "A" });
    await db
      .insert(schema.habit)
      .values({ id: crypto.randomUUID(), title: "B" });

    const rows = await allHabits(db);
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.title)).toContain("A");
    expect(rows.map((r) => r.title)).toContain("B");
  });

  it("returns empty when no habits exist", async () => {
    const db = getDb();
    const rows = await allHabits(db);
    expect(rows).toHaveLength(0);
  });
});

describe("habitById", () => {
  it("returns the habit with matching id", async () => {
    const db = getDb();
    const [h] = await db
      .insert(schema.habit)
      .values({ id: crypto.randomUUID(), title: "Find me" })
      .returning();

    const rows = await habitById(db, h.id);
    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe("Find me");
  });

  it("returns empty for non-existent id", async () => {
    const db = getDb();
    const rows = await habitById(db, "00000000-0000-0000-0000-0000000000ff");
    expect(rows).toHaveLength(0);
  });
});

describe("goalForHabitFull", () => {
  it("returns full goal record for a habit", async () => {
    const db = getDb();
    const [h] = await db
      .insert(schema.habit)
      .values({ id: crypto.randomUUID(), title: "Goal" })
      .returning();
    await db
      .insert(schema.goal)
      .values({ habitId: h.id, regularity: "week", frequency: 5 });

    const rows = await goalForHabitFull(db, h.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveProperty("id");
    expect(rows[0]).toHaveProperty("habitId", h.id);
    expect(rows[0].frequency).toBe(5);
    expect(rows[0].regularity).toBe("week");
  });
});

describe("checkInsForHabit", () => {
  it("returns check-ins ordered by timestamp descending", async () => {
    const db = getDb();
    const [h] = await db
      .insert(schema.habit)
      .values({ id: crypto.randomUUID(), title: "CI" })
      .returning();
    const t1 = subDays(new Date(), 2);
    const t2 = new Date();
    await db
      .insert(schema.checkIn)
      .values({ id: crypto.randomUUID(), habitId: h.id, timestamp: t1 });
    await db
      .insert(schema.checkIn)
      .values({ id: crypto.randomUUID(), habitId: h.id, timestamp: t2 });

    const rows = await checkInsForHabit(db, h.id);
    expect(rows).toHaveLength(2);
    expect(rows[0].timestamp.getTime()).toBeGreaterThan(
      rows[1].timestamp.getTime(),
    );
  });
});

describe("calendarCheckIns", () => {
  it("returns check-ins joined with habit title", async () => {
    const db = getDb();
    const [h] = await db
      .insert(schema.habit)
      .values({ id: crypto.randomUUID(), title: "Cal" })
      .returning();
    await db
      .insert(schema.checkIn)
      .values({ id: crypto.randomUUID(), habitId: h.id });

    const rows = await calendarCheckIns(db);
    expect(rows).toHaveLength(1);
    expect(rows[0].habitTitle).toBe("Cal");
    expect(rows[0].habitId).toBe(h.id);
  });
});

describe("schedulesForGoal", () => {
  describe("with two schedules", () => {
    let rows: Awaited<ReturnType<typeof schedulesForGoal>>;

    beforeEach(async () => {
      const db = getDb();
      const [h] = await db
        .insert(schema.habit)
        .values({ id: crypto.randomUUID(), title: "Scheduled" })
        .returning();
      const [g] = await db
        .insert(schema.goal)
        .values({ habitId: h.id, regularity: "week", frequency: 3 })
        .returning();
      await db.insert(schema.schedule).values({
        goalId: g.id,
        hour: 9,
        minute: 30,
        days: 42,
        reminder: true,
      });
      await db.insert(schema.schedule).values({
        goalId: g.id,
        hour: 18,
        minute: 0,
        days: 42,
        reminder: false,
      });
      rows = await schedulesForGoal(db, g.id);
    });

    it("returns both schedules", () => {
      expect(rows).toHaveLength(2);
    });

    it("returns correct data for first schedule", () => {
      expect(rows[0]).toMatchObject({
        hour: 9,
        minute: 30,
        days: 42,
        reminder: true,
      });
    });

    it("returns correct data for second schedule", () => {
      expect(rows[1]).toMatchObject({
        hour: 18,
        minute: 0,
        days: 42,
        reminder: false,
      });
    });
  });

  it("returns empty when goal has no schedules", async () => {
    const db = getDb();
    const [h] = await db
      .insert(schema.habit)
      .values({ id: crypto.randomUUID(), title: "No sched" })
      .returning();
    const [g] = await db
      .insert(schema.goal)
      .values({ habitId: h.id, regularity: "day", frequency: 1 })
      .returning();

    const rows = await schedulesForGoal(db, g.id);
    expect(rows).toHaveLength(0);
  });

  it("returns empty for non-existent goal id", async () => {
    const db = getDb();
    const rows = await schedulesForGoal(db, 9999);
    expect(rows).toHaveLength(0);
  });
});

describe("habitsByIds", () => {
  it("returns habits matching the given ids", async () => {
    const db = getDb();
    const [h1] = await db
      .insert(schema.habit)
      .values({ id: crypto.randomUUID(), title: "Alpha" })
      .returning();
    const [h2] = await db
      .insert(schema.habit)
      .values({ id: crypto.randomUUID(), title: "Beta" })
      .returning();
    await db
      .insert(schema.habit)
      .values({ id: crypto.randomUUID(), title: "Gamma" });

    const rows = await habitsByIds(db, [h1.id, h2.id]);
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.title).sort()).toEqual(["Alpha", "Beta"]);
  });

  it("returns empty for an empty id list", async () => {
    const db = getDb();
    await db
      .insert(schema.habit)
      .values({ id: crypto.randomUUID(), title: "Lonely" });

    const rows = await habitsByIds(db, []);
    expect(rows).toHaveLength(0);
  });

  it("returns empty for non-existent ids", async () => {
    const db = getDb();
    const rows = await habitsByIds(db, [
      "00000000-0000-0000-0000-0000000000ff",
    ]);
    expect(rows).toHaveLength(0);
  });
});

describe("checkInCount edge cases", () => {
  describe("for habit with no check-ins", () => {
    it("returns zero", async () => {
      const db = getDb();
      const [h] = await db
        .insert(schema.habit)
        .values({ id: crypto.randomUUID(), title: "Empty" })
        .returning();
      const [row] = await checkInCount(db, h.id);
      expect(row.value).toBe(0);
    });
  });

  describe("with a future since date", () => {
    it("returns zero even with existing check-ins", async () => {
      const db = getDb();
      const [h] = await db
        .insert(schema.habit)
        .values({ id: crypto.randomUUID(), title: "Future" })
        .returning();
      await db
        .insert(schema.checkIn)
        .values({ id: crypto.randomUUID(), habitId: h.id });
      const futureDate = new Date(Date.now() + 86400000);
      const [row] = await checkInCount(db, h.id, futureDate);
      expect(row.value).toBe(0);
    });
  });
});

describe("recentCheckIns edge cases", () => {
  it("returns empty for habit with no check-ins", async () => {
    const db = getDb();
    const [h] = await db
      .insert(schema.habit)
      .values({ id: crypto.randomUUID(), title: "None" })
      .returning();
    const rows = await recentCheckIns(db, h.id);
    expect(rows).toHaveLength(0);
  });
});

describe("checkInsForHabitsOnDay", () => {
  const at = (h: number, m = 0) => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m);
  };
  const dayStart = () => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  };
  const dayEnd = () => {
    const d = dayStart();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
  };

  it("returns today's check-ins for the given habits, chronologically", async () => {
    const db = getDb();
    const [a] = await db
      .insert(schema.habit)
      .values({ id: crypto.randomUUID(), title: "A" })
      .returning();
    const [b] = await db
      .insert(schema.habit)
      .values({ id: crypto.randomUUID(), title: "B" })
      .returning();
    const [c] = await db
      .insert(schema.habit)
      .values({ id: crypto.randomUUID(), title: "C" })
      .returning();
    await db
      .insert(schema.checkIn)
      .values({ id: crypto.randomUUID(), habitId: a.id, timestamp: at(9) });
    await db
      .insert(schema.checkIn)
      .values({ id: crypto.randomUUID(), habitId: b.id, timestamp: at(7) });
    // Not in the query set:
    await db
      .insert(schema.checkIn)
      .values({ id: crypto.randomUUID(), habitId: c.id, timestamp: at(8) });
    // Yesterday:
    const yesterday = subDays(at(12), 1);
    await db
      .insert(schema.checkIn)
      .values({ id: crypto.randomUUID(), habitId: a.id, timestamp: yesterday });

    const rows = await checkInsForHabitsOnDay(
      db,
      [a.id, b.id],
      dayStart(),
      dayEnd(),
    );
    expect(rows).toHaveLength(2);
    expect(rows[0].habitId).toBe(b.id);
    expect(rows[0].timestamp.getHours()).toBe(7);
    expect(rows[1].habitId).toBe(a.id);
    expect(rows[1].timestamp.getHours()).toBe(9);
    expect(rows[0].skipped).toBe(false);
  });

  it("returns skipped flag", async () => {
    const db = getDb();
    const [a] = await db
      .insert(schema.habit)
      .values({ id: crypto.randomUUID(), title: "A" })
      .returning();
    await db.insert(schema.checkIn).values({
      id: crypto.randomUUID(),
      habitId: a.id,
      timestamp: at(10),
      skipped: true,
    });

    const [row] = await checkInsForHabitsOnDay(
      db,
      [a.id],
      dayStart(),
      dayEnd(),
    );
    expect(row.skipped).toBe(true);
  });

  it("returns nothing for empty habit list", async () => {
    const db = getDb();
    const [a] = await db
      .insert(schema.habit)
      .values({ id: crypto.randomUUID(), title: "A" })
      .returning();
    await db
      .insert(schema.checkIn)
      .values({ id: crypto.randomUUID(), habitId: a.id, timestamp: at(8) });

    const rows = await checkInsForHabitsOnDay(db, [], dayStart(), dayEnd());
    expect(rows).toHaveLength(0);
  });
});

describe("schedulesForHabits", () => {
  it("returns all schedules for the given habits, keyed by habitId", async () => {
    const db = getDb();
    const [a] = await db
      .insert(schema.habit)
      .values({ id: crypto.randomUUID(), title: "A" })
      .returning();
    const [b] = await db
      .insert(schema.habit)
      .values({ id: crypto.randomUUID(), title: "B" })
      .returning();
    const [ga] = await db
      .insert(schema.goal)
      .values({ habitId: a.id, regularity: "day", frequency: 1 })
      .returning();
    const [gb] = await db
      .insert(schema.goal)
      .values({ habitId: b.id, regularity: "day", frequency: 1 })
      .returning();
    await db
      .insert(schema.schedule)
      .values({ goalId: ga.id, hour: 7, minute: 30 });
    await db
      .insert(schema.schedule)
      .values({ goalId: ga.id, hour: 20, minute: 0 });
    await db
      .insert(schema.schedule)
      .values({ goalId: gb.id, hour: 12, minute: 0 });

    const rows = await schedulesForHabits(db, [a.id, b.id]);
    expect(rows).toHaveLength(3);
    const aRows = rows.filter((r) => r.habitId === a.id);
    expect(aRows).toHaveLength(2);
    const bRows = rows.filter((r) => r.habitId === b.id);
    expect(bRows).toHaveLength(1);
    expect(bRows[0].hour).toBe(12);
  });

  it("returns empty for empty habit list", async () => {
    const db = getDb();
    const rows = await schedulesForHabits(db, []);
    expect(rows).toHaveLength(0);
  });
});
