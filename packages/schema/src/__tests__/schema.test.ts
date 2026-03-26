import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execSync } from "node:child_process";
import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import { eq } from "drizzle-orm";
import postgres from "postgres";
import * as schema from "../index.js";

const connectionString = process.env.DATABASE_URL!;
let client: ReturnType<typeof postgres>;
let db: ReturnType<typeof drizzle>;

beforeAll(async () => {
  execSync("pnpm exec drizzle-kit push --force", {
    cwd: new URL("../..", import.meta.url).pathname,
    env: { ...process.env },
    stdio: "inherit",
  });

  client = postgres(connectionString);
  db = drizzle(client, { schema });
});

afterAll(async () => {
  await client.end();
});

describe("schema", () => {
  it("should have created the regularity enum", async () => {
    const result = await db.execute(
      sql`SELECT unnest(enum_range(NULL::regularity))::text AS value`,
    );
    const values = result.map((r) => r.value);
    expect(values).toEqual(["day", "week", "month"]);
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
    expect(checkIn.timestamp).toBeDefined();
  });

  it("should insert a goal referencing a habit", async () => {
    const [habit] = await db
      .insert(schema.habit)
      .values({ title: "Meditate", description: "Daily meditation" })
      .returning();

    const [goal] = await db
      .insert(schema.goal)
      .values({ habitId: habit.id, regularity: "day", count: 1 })
      .returning();

    expect(goal.habitId).toBe(habit.id);
    expect(goal.regularity).toBe("day");
    expect(goal.count).toBe(1);
  });

  it("should enforce unique constraint on goal (habitId, regularity)", async () => {
    const [habit] = await db
      .insert(schema.habit)
      .values({ title: "Walk", description: "Walk daily" })
      .returning();

    await db
      .insert(schema.goal)
      .values({ habitId: habit.id, regularity: "week", count: 3 });

    await expect(
      db
        .insert(schema.goal)
        .values({ habitId: habit.id, regularity: "week", count: 5 }),
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
      .values({ habitId: habit.id, regularity: "month", count: 2 });

    await db.delete(schema.habit).where(eq(schema.habit.id, habit.id));

    const remaining = await db
      .select()
      .from(schema.goal)
      .where(eq(schema.goal.habitId, habit.id));

    expect(remaining).toHaveLength(0);
  });
});
