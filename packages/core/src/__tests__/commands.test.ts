import { describe, it, expect } from "vitest";
import { eq } from "drizzle-orm";
import * as schema from "@nag/schema";
import { ZodError } from "zod";
import { processCommand } from "../commands/processor";
import { setupTestDb } from "./testDb";

const getDb = setupTestDb("commands-test.db");

describe("CreateHabit", () => {
  it("creates a habit without a goal", async () => {
    const db = getDb();
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
    const db = getDb();
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
    const db = getDb();
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
    const db = getDb();
    await expect(
      processCommand(db, { type: "CreateHabit", title: "" }),
    ).rejects.toThrow();
  });
});

describe("UpdateHabit", () => {
  it("updates the title", async () => {
    const db = getDb();
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
    const db = getDb();
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
    const db = getDb();
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
    const db = getDb();
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
    const db = getDb();
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
    const db = getDb();
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
    const db = getDb();
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
    const db = getDb();
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
    const db = getDb();
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
    const db = getDb();
    await processCommand(db, {
      type: "CreateHabit",
      title: "Audit test",
      goal: { regularity: "week", frequency: 2 },
    });

    const logs = await db.select().from(schema.auditLog);
    expect(logs).toHaveLength(1);
    expect(logs[0].commandType).toBe("CreateHabit");
    expect(logs[0].timestamp).toBeInstanceOf(Date);

    const payload = JSON.parse(logs[0].payload!);
    expect(payload.title).toBe("Audit test");
    expect(payload.goal).toEqual({ regularity: "week", frequency: 2 });
  });

  it("records payload for commands with fields beyond type", async () => {
    const db = getDb();
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
    const db = getDb();
    await expect(
      processCommand(db, { type: "CreateHabit", title: "" }),
    ).rejects.toThrow();

    const logs = await db.select().from(schema.auditLog);
    expect(logs).toHaveLength(0);
  });

  it("accumulates audit entries across commands", async () => {
    const db = getDb();
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

describe("processCommand validation", () => {
  it("rejects unknown command type", async () => {
    const db = getDb();
    await expect(
      processCommand(db, { type: "DoSomething" }),
    ).rejects.toThrow(ZodError);

    const logs = await db.select().from(schema.auditLog);
    expect(logs).toHaveLength(0);
  });

  it("rejects missing required field (no title)", async () => {
    const db = getDb();
    await expect(
      processCommand(db, { type: "CreateHabit" }),
    ).rejects.toThrow(ZodError);

    const logs = await db.select().from(schema.auditLog);
    expect(logs).toHaveLength(0);
  });

  it("rejects wrong field type (string instead of number)", async () => {
    const db = getDb();
    await expect(
      processCommand(db, { type: "DeleteHabit", habitId: "abc" }),
    ).rejects.toThrow(ZodError);

    const logs = await db.select().from(schema.auditLog);
    expect(logs).toHaveLength(0);
  });

  it("rejects negative id", async () => {
    const db = getDb();
    await expect(
      processCommand(db, { type: "CreateCheckIn", habitId: -1 }),
    ).rejects.toThrow(ZodError);

    const logs = await db.select().from(schema.auditLog);
    expect(logs).toHaveLength(0);
  });

  it("rejects invalid regularity enum", async () => {
    const db = getDb();
    await expect(
      processCommand(db, {
        type: "CreateHabit",
        title: "X",
        goal: { regularity: "year", frequency: 1 },
      }),
    ).rejects.toThrow(ZodError);

    const logs = await db.select().from(schema.auditLog);
    expect(logs).toHaveLength(0);
  });

  it("rejects zero frequency in goal", async () => {
    const db = getDb();
    await expect(
      processCommand(db, {
        type: "CreateHabit",
        title: "X",
        goal: { regularity: "day", frequency: 0 },
      }),
    ).rejects.toThrow(ZodError);

    const logs = await db.select().from(schema.auditLog);
    expect(logs).toHaveLength(0);
  });

  it("rejects empty object input", async () => {
    const db = getDb();
    await expect(processCommand(db, {})).rejects.toThrow(ZodError);

    const logs = await db.select().from(schema.auditLog);
    expect(logs).toHaveLength(0);
  });

  it("rejects non-object input", async () => {
    const db = getDb();
    await expect(processCommand(db, "hello")).rejects.toThrow(ZodError);

    const logs = await db.select().from(schema.auditLog);
    expect(logs).toHaveLength(0);
  });
});

describe("processCommand handler errors", () => {
  it("throws on FK violation (check-in for non-existent habit)", async () => {
    const db = getDb();
    await expect(
      processCommand(db, { type: "CreateCheckIn", habitId: 99999 }),
    ).rejects.toThrow();

    const logs = await db.select().from(schema.auditLog);
    expect(logs).toHaveLength(0);
  });

  it("does not leave partial data after handler error", async () => {
    const db = getDb();
    const habitsBefore = await db.select().from(schema.habit);
    const checkInsBefore = await db.select().from(schema.checkIn);

    await expect(
      processCommand(db, { type: "CreateCheckIn", habitId: 99999 }),
    ).rejects.toThrow();

    const habitsAfter = await db.select().from(schema.habit);
    const checkInsAfter = await db.select().from(schema.checkIn);
    expect(habitsAfter).toHaveLength(habitsBefore.length);
    expect(checkInsAfter).toHaveLength(checkInsBefore.length);
  });

  it("rolls back transaction on handler error (no audit written)", async () => {
    const db = getDb();
    const { habitId } = (await processCommand(db, {
      type: "CreateHabit",
      title: "Valid",
    })) as { habitId: number };

    await db.delete(schema.auditLog);

    await expect(
      processCommand(db, { type: "CreateCheckIn", habitId: 99999 }),
    ).rejects.toThrow();

    const logs = await db.select().from(schema.auditLog);
    expect(logs).toHaveLength(0);

    const habits = await db
      .select()
      .from(schema.habit)
      .where(eq(schema.habit.id, habitId));
    expect(habits).toHaveLength(1);
  });
});
