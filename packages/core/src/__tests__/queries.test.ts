import { describe, it, expect } from "vitest";
import * as schema from "@nag/schema";
import { goalForHabit, checkInCount, recentCheckIns } from "../queries";
import { subDays } from "date-fns";
import { setupTestDb } from "./testDb";

const getDb = setupTestDb("core-test.db");

describe("goalForHabit", () => {
  it("returns the goal for a habit", async () => {
    const db = getDb();
    const [h] = await db.insert(schema.habit).values({ title: "Test" }).returning();
    await db.insert(schema.goal).values({ habitId: h.id, regularity: "day", frequency: 3 });

    const goals = await goalForHabit(db, h.id);
    expect(goals).toHaveLength(1);
    expect(goals[0].frequency).toBe(3);
    expect(goals[0].regularity).toBe("day");
    expect(goals[0].createdAt).toBeInstanceOf(Date);
  });

  it("returns empty when no goal exists", async () => {
    const db = getDb();
    const [h] = await db.insert(schema.habit).values({ title: "No goal" }).returning();
    const goals = await goalForHabit(db, h.id);
    expect(goals).toHaveLength(0);
  });
});

describe("checkInCount", () => {
  it("counts all check-ins for a habit", async () => {
    const db = getDb();
    const [h] = await db.insert(schema.habit).values({ title: "Count" }).returning();
    await db.insert(schema.checkIn).values({ habitId: h.id });
    await db.insert(schema.checkIn).values({ habitId: h.id });

    const [row] = await checkInCount(db, h.id);
    expect(row.value).toBe(2);
  });

  it("counts only check-ins since a date", async () => {
    const db = getDb();
    const [h] = await db.insert(schema.habit).values({ title: "Since" }).returning();
    const old = subDays(new Date(), 5);
    const recent = new Date();
    await db.insert(schema.checkIn).values({ habitId: h.id, timestamp: old });
    await db.insert(schema.checkIn).values({ habitId: h.id, timestamp: recent });

    const since = subDays(new Date(), 1);
    const [row] = await checkInCount(db, h.id, since);
    expect(row.value).toBe(1);
  });
});

describe("recentCheckIns", () => {
  it("returns check-ins in descending order", async () => {
    const db = getDb();
    const [h] = await db.insert(schema.habit).values({ title: "Recent" }).returning();
    const t1 = subDays(new Date(), 3);
    const t2 = subDays(new Date(), 1);
    const t3 = new Date();
    await db.insert(schema.checkIn).values({ habitId: h.id, timestamp: t1 });
    await db.insert(schema.checkIn).values({ habitId: h.id, timestamp: t2 });
    await db.insert(schema.checkIn).values({ habitId: h.id, timestamp: t3 });

    const rows = await recentCheckIns(db, h.id);
    expect(rows).toHaveLength(3);
    expect(rows[0].timestamp.getTime()).toBeGreaterThan(rows[1].timestamp.getTime());
    expect(rows[1].timestamp.getTime()).toBeGreaterThan(rows[2].timestamp.getTime());
  });

  it("respects limit", async () => {
    const db = getDb();
    const [h] = await db.insert(schema.habit).values({ title: "Limit" }).returning();
    for (let i = 0; i < 5; i++) {
      await db.insert(schema.checkIn).values({ habitId: h.id });
    }

    const rows = await recentCheckIns(db, h.id, undefined, 2);
    expect(rows).toHaveLength(2);
  });
});
