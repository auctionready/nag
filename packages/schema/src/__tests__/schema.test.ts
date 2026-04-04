import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execSync } from "node:child_process";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { eq } from "drizzle-orm";
import Database from "better-sqlite3";
import { unlinkSync } from "node:fs";
import * as schema from "../index";
import { regularityValues } from "../regularity";

const TEST_DB = "test.db";
let sqlite: InstanceType<typeof Database>;
let db: ReturnType<typeof drizzle>;

beforeAll(() => {
  execSync(
    "pnpm exec drizzle-kit push --force --config=drizzle.config.test.ts",
    {
      cwd: new URL("../..", import.meta.url).pathname,
      env: { ...process.env, DATABASE_URL: TEST_DB },
      stdio: "inherit",
    },
  );

  sqlite = new Database(TEST_DB);
  sqlite.pragma("foreign_keys = ON");
  db = drizzle(sqlite, { schema });
});

afterAll(() => {
  sqlite.close();
  try {
    unlinkSync(TEST_DB);
  } catch {}
});

describe("schema", () => {
  it("should export regularity values", () => {
    expect(regularityValues).toEqual(["day", "week", "month"]);
  });

  it("should insert and query a habit", async () => {
    const [inserted] = await db
      .insert(schema.habit)
      .values({ title: "Exercise", description: "Daily workout" })
      .returning();

    expect(inserted.id).toBeDefined();
    expect(inserted.title).toBe("Exercise");

    const [queried] = await db
      .select()
      .from(schema.habit)
      .where(eq(schema.habit.id, inserted.id));

    expect(queried.title).toBe("Exercise");
  });

  it("should insert a habit without description", async () => {
    const [inserted] = await db
      .insert(schema.habit)
      .values({ title: "Stretch" })
      .returning();

    expect(inserted.id).toBeDefined();
    expect(inserted.title).toBe("Stretch");
    expect(inserted.description).toBeNull();
  });

  it("should insert a check_in referencing a habit", async () => {
    const [habit] = await db
      .insert(schema.habit)
      .values({ title: "Read", description: "Read daily" })
      .returning();

    const [checkIn] = await db
      .insert(schema.checkIn)
      .values({ habitId: habit.id })
      .returning();

    expect(checkIn.habitId).toBe(habit.id);
    expect(checkIn.timestamp).toBeInstanceOf(Date);
  });

  it("should insert a goal referencing a habit", async () => {
    const [habit] = await db
      .insert(schema.habit)
      .values({ title: "Meditate", description: "Daily meditation" })
      .returning();

    const [goal] = await db
      .insert(schema.goal)
      .values({ habitId: habit.id, regularity: "day", frequency: 1 })
      .returning();

    expect(goal.habitId).toBe(habit.id);
    expect(goal.regularity).toBe("day");
    expect(goal.frequency).toBe(1);
  });

  it("should enforce unique constraint on goal (habitId, regularity)", async () => {
    const [habit] = await db
      .insert(schema.habit)
      .values({ title: "Walk", description: "Walk daily" })
      .returning();

    await db
      .insert(schema.goal)
      .values({ habitId: habit.id, regularity: "week", frequency: 3 });

    await expect(
      db
        .insert(schema.goal)
        .values({ habitId: habit.id, regularity: "week", frequency: 5 }),
    ).rejects.toThrow();
  });

  it("should cascade delete check_ins when habit is deleted", async () => {
    const [habit] = await db
      .insert(schema.habit)
      .values({ title: "Temp", description: "Will be deleted" })
      .returning();

    await db.insert(schema.checkIn).values({ habitId: habit.id });

    await db.delete(schema.habit).where(eq(schema.habit.id, habit.id));

    const remaining = await db
      .select()
      .from(schema.checkIn)
      .where(eq(schema.checkIn.habitId, habit.id));

    expect(remaining).toHaveLength(0);
  });

  it("should cascade delete goals when habit is deleted", async () => {
    const [habit] = await db
      .insert(schema.habit)
      .values({ title: "Temp2", description: "Will be deleted" })
      .returning();

    await db
      .insert(schema.goal)
      .values({ habitId: habit.id, regularity: "month", frequency: 2 });

    await db.delete(schema.habit).where(eq(schema.habit.id, habit.id));

    const remaining = await db
      .select()
      .from(schema.goal)
      .where(eq(schema.goal.habitId, habit.id));

    expect(remaining).toHaveLength(0);
  });

  it("should insert a schedule referencing a goal", async () => {
    const [h] = await db
      .insert(schema.habit)
      .values({ title: "Scheduled" })
      .returning();

    const [g] = await db
      .insert(schema.goal)
      .values({ habitId: h.id, regularity: "week", frequency: 3 })
      .returning();

    const [s] = await db
      .insert(schema.schedule)
      .values({ goalId: g.id, hour: 9, minute: 30, days: 42, reminder: true })
      .returning();

    expect(s.goalId).toBe(g.id);
    expect(s.hour).toBe(9);
    expect(s.minute).toBe(30);
    expect(s.days).toBe(42);
    expect(s.reminder).toBe(true);
    expect(s.createdAt).toBeInstanceOf(Date);
  });

  it("should cascade delete schedules when goal is deleted", async () => {
    const [h] = await db
      .insert(schema.habit)
      .values({ title: "CascadeSchedule" })
      .returning();

    const [g] = await db
      .insert(schema.goal)
      .values({ habitId: h.id, regularity: "day", frequency: 2 })
      .returning();

    await db
      .insert(schema.schedule)
      .values({ goalId: g.id, hour: 8, minute: 0 });

    await db.delete(schema.goal).where(eq(schema.goal.id, g.id));

    const remaining = await db
      .select()
      .from(schema.schedule)
      .where(eq(schema.schedule.goalId, g.id));

    expect(remaining).toHaveLength(0);
  });

  it("should cascade delete schedules when habit is deleted", async () => {
    const [h] = await db
      .insert(schema.habit)
      .values({ title: "CascadeViaHabit" })
      .returning();

    const [g] = await db
      .insert(schema.goal)
      .values({ habitId: h.id, regularity: "month", frequency: 1 })
      .returning();

    await db
      .insert(schema.schedule)
      .values({ goalId: g.id, hour: 10, minute: 0, dayOfMonth: 15 });

    await db.delete(schema.habit).where(eq(schema.habit.id, h.id));

    const remaining = await db
      .select()
      .from(schema.schedule)
      .where(eq(schema.schedule.goalId, g.id));

    expect(remaining).toHaveLength(0);
  });

  it("should insert an audit log entry", async () => {
    const [log] = await db
      .insert(schema.auditLog)
      .values({
        commandType: "CreateHabit",
        payload: JSON.stringify({ title: "Test" }),
      })
      .returning();

    expect(log.id).toBeDefined();
    expect(log.commandType).toBe("CreateHabit");
    expect(log.payload).toBe('{"title":"Test"}');
    expect(log.timestamp).toBeInstanceOf(Date);
  });

  it("should allow audit log without payload", async () => {
    const [log] = await db
      .insert(schema.auditLog)
      .values({ commandType: "DeleteHabit" })
      .returning();

    expect(log.commandType).toBe("DeleteHabit");
    expect(log.payload).toBeNull();
  });
});
