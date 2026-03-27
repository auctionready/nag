import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import Database from "better-sqlite3";
import { unlinkSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";
import { eq } from "drizzle-orm";
import * as schema from "@nag/schema";
import { processCommand } from "../commands/processor";

const TEST_DB = "commands-test.db";
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
  await db.delete(schema.auditLog);
  await db.delete(schema.checkIn);
  await db.delete(schema.goal);
  await db.delete(schema.habit);
});

describe("CreateHabit", () => {
  it("creates a habit without a goal", async () => {
    const result = await processCommand(db, {
      type: "CreateHabit",
      title: "Exercise",
    });

    expect(result).toHaveProperty("habitId");
    const [h] = await db
      .select()
      .from(schema.habit)
      .where(eq(schema.habit.id, (result as { habitId: number }).habitId));
    expect(h.title).toBe("Exercise");
    expect(h.description).toBeNull();
  });

  it("creates a habit with description", async () => {
    const result = await processCommand(db, {
      type: "CreateHabit",
      title: "Read",
      description: "Read for 30 minutes",
    });

    const [h] = await db
      .select()
      .from(schema.habit)
      .where(eq(schema.habit.id, (result as { habitId: number }).habitId));
    expect(h.description).toBe("Read for 30 minutes");
  });

  it("creates a habit with a goal", async () => {
    const result = await processCommand(db, {
      type: "CreateHabit",
      title: "Meditate",
      goal: { regularity: "day", frequency: 1 },
    });

    const habitId = (result as { habitId: number }).habitId;
    const goals = await db
      .select()
      .from(schema.goal)
      .where(eq(schema.goal.habitId, habitId));
    expect(goals).toHaveLength(1);
    expect(goals[0].regularity).toBe("day");
    expect(goals[0].frequency).toBe(1);
  });

  it("rejects invalid input", async () => {
    await expect(
      processCommand(db, { type: "CreateHabit", title: "" }),
    ).rejects.toThrow();
  });
});

describe("UpdateHabit", () => {
  it("updates the title", async () => {
    const { habitId } = (await processCommand(db, {
      type: "CreateHabit",
      title: "Old",
    })) as { habitId: number };

    await processCommand(db, {
      type: "UpdateHabit",
      habitId,
      title: "New",
    });

    const [h] = await db
      .select()
      .from(schema.habit)
      .where(eq(schema.habit.id, habitId));
    expect(h.title).toBe("New");
  });

  it("clears description when null", async () => {
    const { habitId } = (await processCommand(db, {
      type: "CreateHabit",
      title: "Test",
      description: "Some desc",
    })) as { habitId: number };

    await processCommand(db, {
      type: "UpdateHabit",
      habitId,
      description: null,
    });

    const [h] = await db
      .select()
      .from(schema.habit)
      .where(eq(schema.habit.id, habitId));
    expect(h.description).toBeNull();
  });

  it("leaves description unchanged when undefined", async () => {
    const { habitId } = (await processCommand(db, {
      type: "CreateHabit",
      title: "Test",
      description: "Keep me",
    })) as { habitId: number };

    await processCommand(db, {
      type: "UpdateHabit",
      habitId,
      title: "Updated",
    });

    const [h] = await db
      .select()
      .from(schema.habit)
      .where(eq(schema.habit.id, habitId));
    expect(h.description).toBe("Keep me");
  });

  it("replaces the goal", async () => {
    const { habitId } = (await processCommand(db, {
      type: "CreateHabit",
      title: "Test",
      goal: { regularity: "day", frequency: 1 },
    })) as { habitId: number };

    await processCommand(db, {
      type: "UpdateHabit",
      habitId,
      goal: { regularity: "week", frequency: 3 },
    });

    const goals = await db
      .select()
      .from(schema.goal)
      .where(eq(schema.goal.habitId, habitId));
    expect(goals).toHaveLength(1);
    expect(goals[0].regularity).toBe("week");
    expect(goals[0].frequency).toBe(3);
  });

  it("deletes the goal when null", async () => {
    const { habitId } = (await processCommand(db, {
      type: "CreateHabit",
      title: "Test",
      goal: { regularity: "day", frequency: 1 },
    })) as { habitId: number };

    await processCommand(db, {
      type: "UpdateHabit",
      habitId,
      goal: null,
    });

    const goals = await db
      .select()
      .from(schema.goal)
      .where(eq(schema.goal.habitId, habitId));
    expect(goals).toHaveLength(0);
  });

  it("leaves goal unchanged when undefined", async () => {
    const { habitId } = (await processCommand(db, {
      type: "CreateHabit",
      title: "Test",
      goal: { regularity: "day", frequency: 2 },
    })) as { habitId: number };

    await processCommand(db, {
      type: "UpdateHabit",
      habitId,
      title: "Updated",
    });

    const goals = await db
      .select()
      .from(schema.goal)
      .where(eq(schema.goal.habitId, habitId));
    expect(goals).toHaveLength(1);
    expect(goals[0].frequency).toBe(2);
  });
});

describe("DeleteHabit", () => {
  it("deletes the habit and cascades", async () => {
    const { habitId } = (await processCommand(db, {
      type: "CreateHabit",
      title: "Temp",
      goal: { regularity: "day", frequency: 1 },
    })) as { habitId: number };

    await processCommand(db, { type: "CreateCheckIn", habitId });

    await processCommand(db, { type: "DeleteHabit", habitId });

    const habits = await db
      .select()
      .from(schema.habit)
      .where(eq(schema.habit.id, habitId));
    expect(habits).toHaveLength(0);

    const goals = await db
      .select()
      .from(schema.goal)
      .where(eq(schema.goal.habitId, habitId));
    expect(goals).toHaveLength(0);

    const checkIns = await db
      .select()
      .from(schema.checkIn)
      .where(eq(schema.checkIn.habitId, habitId));
    expect(checkIns).toHaveLength(0);
  });
});

describe("CreateCheckIn", () => {
  it("creates a check-in for a habit", async () => {
    const { habitId } = (await processCommand(db, {
      type: "CreateHabit",
      title: "Test",
    })) as { habitId: number };

    const result = await processCommand(db, {
      type: "CreateCheckIn",
      habitId,
    });

    expect(result).toHaveProperty("checkInId");
    const checkIns = await db
      .select()
      .from(schema.checkIn)
      .where(eq(schema.checkIn.habitId, habitId));
    expect(checkIns).toHaveLength(1);
  });
});

describe("DeleteCheckIn", () => {
  it("deletes a specific check-in", async () => {
    const { habitId } = (await processCommand(db, {
      type: "CreateHabit",
      title: "Test",
    })) as { habitId: number };

    const { checkInId } = (await processCommand(db, {
      type: "CreateCheckIn",
      habitId,
    })) as { checkInId: number };

    await processCommand(db, { type: "CreateCheckIn", habitId });

    await processCommand(db, { type: "DeleteCheckIn", checkInId });

    const checkIns = await db
      .select()
      .from(schema.checkIn)
      .where(eq(schema.checkIn.habitId, habitId));
    expect(checkIns).toHaveLength(1);
  });
});

describe("audit logging", () => {
  it("records an audit entry for each command", async () => {
    const { habitId } = (await processCommand(db, {
      type: "CreateHabit",
      title: "Audit test",
      goal: { regularity: "week", frequency: 2 },
    })) as { habitId: number };

    const logs = await db.select().from(schema.auditLog);
    expect(logs).toHaveLength(1);
    expect(logs[0].commandType).toBe("CreateHabit");
    expect(logs[0].timestamp).toBeInstanceOf(Date);

    const payload = JSON.parse(logs[0].payload!);
    expect(payload.title).toBe("Audit test");
    expect(payload.goal).toEqual({ regularity: "week", frequency: 2 });
  });

  it("records null payload for commands with no extra fields", async () => {
    const { habitId } = (await processCommand(db, {
      type: "CreateHabit",
      title: "Setup",
    })) as { habitId: number };

    await processCommand(db, { type: "DeleteHabit", habitId });

    const logs = await db.select().from(schema.auditLog);
    const deleteLog = logs.find((l) => l.commandType === "DeleteHabit");
    expect(deleteLog).toBeDefined();
    expect(deleteLog!.payload).not.toBeNull();
    const payload = JSON.parse(deleteLog!.payload!);
    expect(payload.habitId).toBe(habitId);
  });

  it("does not audit on validation failure", async () => {
    await expect(
      processCommand(db, { type: "CreateHabit", title: "" }),
    ).rejects.toThrow();

    const logs = await db.select().from(schema.auditLog);
    expect(logs).toHaveLength(0);
  });

  it("accumulates audit entries across commands", async () => {
    const { habitId } = (await processCommand(db, {
      type: "CreateHabit",
      title: "Multi",
    })) as { habitId: number };

    await processCommand(db, { type: "CreateCheckIn", habitId });
    await processCommand(db, {
      type: "UpdateHabit",
      habitId,
      title: "Updated",
    });

    const logs = await db.select().from(schema.auditLog);
    expect(logs).toHaveLength(3);
    expect(logs.map((l) => l.commandType)).toEqual([
      "CreateHabit",
      "CreateCheckIn",
      "UpdateHabit",
    ]);
  });
});
