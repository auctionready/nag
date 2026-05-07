import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
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
      .values({
        id: crypto.randomUUID(),
        title: "Exercise",
        description: "Daily workout",
      })
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
      .values({ id: crypto.randomUUID(), title: "Stretch" })
      .returning();

    expect(inserted.id).toBeDefined();
    expect(inserted.title).toBe("Stretch");
    expect(inserted.description).toBeNull();
  });

  it("should insert a check_in referencing a habit", async () => {
    const [habit] = await db
      .insert(schema.habit)
      .values({
        id: crypto.randomUUID(),
        title: "Read",
        description: "Read daily",
      })
      .returning();

    const [checkIn] = await db
      .insert(schema.checkIn)
      .values({ id: crypto.randomUUID(), habitId: habit.id })
      .returning();

    expect(checkIn.habitId).toBe(habit.id);
    expect(checkIn.timestamp).toBeInstanceOf(Date);
  });

  it("should insert a goal referencing a habit", async () => {
    const [habit] = await db
      .insert(schema.habit)
      .values({
        id: crypto.randomUUID(),
        title: "Meditate",
        description: "Daily meditation",
      })
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
      .values({
        id: crypto.randomUUID(),
        title: "Walk",
        description: "Walk daily",
      })
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
      .values({
        id: crypto.randomUUID(),
        title: "Temp",
        description: "Will be deleted",
      })
      .returning();

    await db
      .insert(schema.checkIn)
      .values({ id: crypto.randomUUID(), habitId: habit.id });

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
      .values({
        id: crypto.randomUUID(),
        title: "Temp2",
        description: "Will be deleted",
      })
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

  describe("schedule table", () => {
    let h: { id: string };
    let g: { id: number };

    beforeEach(async () => {
      [h] = await db
        .insert(schema.habit)
        .values({ id: crypto.randomUUID(), title: "Scheduled" })
        .returning();
      [g] = await db
        .insert(schema.goal)
        .values({ habitId: h.id, regularity: "week", frequency: 3 })
        .returning();
    });

    describe("inserting a schedule", () => {
      let s: typeof schema.schedule.$inferSelect;

      beforeEach(async () => {
        [s] = await db
          .insert(schema.schedule)
          .values({
            goalId: g.id,
            hour: 9,
            minute: 30,
            days: 42,
            reminder: true,
          })
          .returning();
      });

      it("references the goal", () => {
        expect(s.goalId).toBe(g.id);
      });

      it("stores hour and minute", () => {
        expect(s.hour).toBe(9);
        expect(s.minute).toBe(30);
      });

      it("stores days bitmask and reminder", () => {
        expect(s.days).toBe(42);
        expect(s.reminder).toBe(true);
      });

      it("auto-sets createdAt", () => {
        expect(s.createdAt).toBeInstanceOf(Date);
      });
    });

    describe("cascade delete", () => {
      beforeEach(async () => {
        await db
          .insert(schema.schedule)
          .values({ goalId: g.id, hour: 8, minute: 0 });
      });

      it("removes schedules when goal is deleted", async () => {
        await db.delete(schema.goal).where(eq(schema.goal.id, g.id));
        const remaining = await db
          .select()
          .from(schema.schedule)
          .where(eq(schema.schedule.goalId, g.id));
        expect(remaining).toHaveLength(0);
      });

      it("removes schedules when habit is deleted", async () => {
        await db.delete(schema.habit).where(eq(schema.habit.id, h.id));
        const remaining = await db
          .select()
          .from(schema.schedule)
          .where(eq(schema.schedule.goalId, g.id));
        expect(remaining).toHaveLength(0);
      });
    });
  });

  describe("outbox table", () => {
    let log: typeof schema.outbox.$inferSelect;

    beforeEach(async () => {
      [log] = await db
        .insert(schema.outbox)
        .values({
          events: JSON.stringify([
            { type: "HabitCreated", payload: { habitId: "h-1", title: "T" } },
          ]),
        })
        .returning();
    });

    it("stores serialized events array", () => {
      const parsed = JSON.parse(log.events) as { type: string }[];
      expect(parsed).toHaveLength(1);
      expect(parsed[0].type).toBe("HabitCreated");
    });

    it("auto-sets createdAt", () => {
      expect(log.createdAt).toBeInstanceOf(Date);
    });

    it("defaults status to pending", () => {
      expect(log.status).toBe("pending");
    });
  });
});
