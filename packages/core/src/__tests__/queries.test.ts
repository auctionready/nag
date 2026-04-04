import { describe, it, expect, beforeEach } from "vitest";
import * as schema from "@nag/schema";
import {
  allHabits,
  habitById,
  goalForHabitFull,
  checkInsForHabit,
  calendarCheckIns,
  goalForHabit,
  checkInCount,
  recentCheckIns,
  schedulesForGoal,
} from "../queries";
import { subDays } from "date-fns";
import { setupTestDb } from "./testDb";

const getDb = setupTestDb("core-test.db");

describe("goalForHabit", () => {
  it("returns the goal for a habit", async () => {
    const db = getDb();
    const [h] = await db
      .insert(schema.habit)
      .values({ title: "Test" })
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
      .values({ title: "No goal" })
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
      .values({ title: "Count" })
      .returning();
    await db.insert(schema.checkIn).values({ habitId: h.id });
    await db.insert(schema.checkIn).values({ habitId: h.id });

    const [row] = await checkInCount(db, h.id);
    expect(row.value).toBe(2);
  });

  it("counts only check-ins since a date", async () => {
    const db = getDb();
    const [h] = await db
      .insert(schema.habit)
      .values({ title: "Since" })
      .returning();
    const old = subDays(new Date(), 5);
    const recent = new Date();
    await db.insert(schema.checkIn).values({ habitId: h.id, timestamp: old });
    await db
      .insert(schema.checkIn)
      .values({ habitId: h.id, timestamp: recent });

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
      .values({ title: "Recent" })
      .returning();
    const t1 = subDays(new Date(), 3);
    const t2 = subDays(new Date(), 1);
    const t3 = new Date();
    await db.insert(schema.checkIn).values({ habitId: h.id, timestamp: t1 });
    await db.insert(schema.checkIn).values({ habitId: h.id, timestamp: t2 });
    await db.insert(schema.checkIn).values({ habitId: h.id, timestamp: t3 });

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
      .values({ title: "Limit" })
      .returning();
    for (let i = 0; i < 5; i++) {
      await db.insert(schema.checkIn).values({ habitId: h.id });
    }

    const rows = await recentCheckIns(db, h.id, undefined, 2);
    expect(rows).toHaveLength(2);
  });
});

describe("allHabits", () => {
  it("returns all habits", async () => {
    const db = getDb();
    await db.insert(schema.habit).values({ title: "A" });
    await db.insert(schema.habit).values({ title: "B" });

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
      .values({ title: "Find me" })
      .returning();

    const rows = await habitById(db, h.id);
    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe("Find me");
  });

  it("returns empty for non-existent id", async () => {
    const db = getDb();
    const rows = await habitById(db, 9999);
    expect(rows).toHaveLength(0);
  });
});

describe("goalForHabitFull", () => {
  it("returns full goal record for a habit", async () => {
    const db = getDb();
    const [h] = await db
      .insert(schema.habit)
      .values({ title: "Goal" })
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
      .values({ title: "CI" })
      .returning();
    const t1 = subDays(new Date(), 2);
    const t2 = new Date();
    await db.insert(schema.checkIn).values({ habitId: h.id, timestamp: t1 });
    await db.insert(schema.checkIn).values({ habitId: h.id, timestamp: t2 });

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
      .values({ title: "Cal" })
      .returning();
    await db.insert(schema.checkIn).values({ habitId: h.id });

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
        .values({ title: "Scheduled" })
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
      .values({ title: "No sched" })
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

describe("checkInCount edge cases", () => {
  describe("for habit with no check-ins", () => {
    it("returns zero", async () => {
      const db = getDb();
      const [h] = await db
        .insert(schema.habit)
        .values({ title: "Empty" })
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
        .values({ title: "Future" })
        .returning();
      await db.insert(schema.checkIn).values({ habitId: h.id });
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
      .values({ title: "None" })
      .returning();
    const rows = await recentCheckIns(db, h.id);
    expect(rows).toHaveLength(0);
  });
});
