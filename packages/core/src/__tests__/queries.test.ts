import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import Database from "better-sqlite3";
import { unlinkSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";
import * as schema from "@nag/schema";
import { goalForHabit, checkInCount, recentCheckIns } from "../queries";
import { subDays } from "date-fns";

const TEST_DB = "core-test.db";
let sqlite: InstanceType<typeof Database>;
let db: ReturnType<typeof drizzle>;

beforeAll(() => {
  sqlite = new Database(TEST_DB);
  sqlite.pragma("foreign_keys = ON");
  db = drizzle(sqlite, { schema });
  const __dirname = dirname(fileURLToPath(import.meta.url));
  migrate(db, {
    migrationsFolder: resolve(__dirname, "../../../schema/drizzle"),
  });
});

afterAll(() => {
  sqlite.close();
  try {
    unlinkSync(TEST_DB);
  } catch {}
});

beforeEach(async () => {
  await db.delete(schema.checkIn);
  await db.delete(schema.goal);
  await db.delete(schema.habit);
});

describe("goalForHabit", () => {
  it("returns the goal for a habit", async () => {
    const [h] = await db.insert(schema.habit).values({ title: "Test" }).returning();
    await db.insert(schema.goal).values({ habitId: h.id, regularity: "day", frequency: 3 });

    const goals = await goalForHabit(db, h.id);
    expect(goals).toHaveLength(1);
    expect(goals[0].frequency).toBe(3);
    expect(goals[0].regularity).toBe("day");
    expect(goals[0].createdAt).toBeInstanceOf(Date);
  });

  it("returns empty when no goal exists", async () => {
    const [h] = await db.insert(schema.habit).values({ title: "No goal" }).returning();
    const goals = await goalForHabit(db, h.id);
    expect(goals).toHaveLength(0);
  });
});

describe("checkInCount", () => {
  it("counts all check-ins for a habit", async () => {
    const [h] = await db.insert(schema.habit).values({ title: "Count" }).returning();
    await db.insert(schema.checkIn).values({ habitId: h.id });
    await db.insert(schema.checkIn).values({ habitId: h.id });

    const [row] = await checkInCount(db, h.id);
    expect(row.value).toBe(2);
  });

  it("counts only check-ins since a date", async () => {
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
    const [h] = await db.insert(schema.habit).values({ title: "Limit" }).returning();
    for (let i = 0; i < 5; i++) {
      await db.insert(schema.checkIn).values({ habitId: h.id });
    }

    const rows = await recentCheckIns(db, h.id, undefined, 2);
    expect(rows).toHaveLength(2);
  });
});
