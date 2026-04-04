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
      .where(eq(schema.habit.id, result.habitId));
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
      .where(eq(schema.habit.id, result.habitId));
    expect(h.description).toBe("Read for 30 minutes");
  });

  it("creates a habit with a goal", async () => {
    const db = getDb();
    const result = await processCommand(db, {
      type: "CreateHabit",
      title: "Meditate",
      goal: { regularity: "day", frequency: 1 },
    });

    const habitId = result.habitId;
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

  it("creates a habit with daily schedules", async () => {
    const db = getDb();
    const result = await processCommand(db, {
      type: "CreateHabit",
      title: "Meditate",
      goal: {
        regularity: "day",
        schedules: [
          { hour: 9, minute: 0 },
          { hour: 14, minute: 30 },
        ],
      },
    });

    const habitId = result.habitId;
    const goals = await db
      .select()
      .from(schema.goal)
      .where(eq(schema.goal.habitId, habitId));
    expect(goals).toHaveLength(1);
    expect(goals[0].frequency).toBe(2);

    const schedules = await db
      .select()
      .from(schema.schedule)
      .where(eq(schema.schedule.goalId, goals[0].id));
    expect(schedules).toHaveLength(2);
    expect(schedules[0].hour).toBe(9);
    expect(schedules[0].minute).toBe(0);
    expect(schedules[0].days).toBeNull();
    expect(schedules[0].dayOfMonth).toBeNull();
    expect(schedules[1].hour).toBe(14);
    expect(schedules[1].minute).toBe(30);
  });

  it("creates a habit with weekly schedules using days bitmask", async () => {
    const db = getDb();
    // Mon(2) + Wed(8) + Fri(32) = 42
    const result = await processCommand(db, {
      type: "CreateHabit",
      title: "Exercise",
      goal: {
        regularity: "week",
        schedules: [{ hour: 7, minute: 0, days: 42 }],
      },
    });

    const habitId = result.habitId;
    const goals = await db
      .select()
      .from(schema.goal)
      .where(eq(schema.goal.habitId, habitId));
    expect(goals[0].frequency).toBe(3);

    const schedules = await db
      .select()
      .from(schema.schedule)
      .where(eq(schema.schedule.goalId, goals[0].id));
    expect(schedules).toHaveLength(1);
    expect(schedules[0].days).toBe(42);
  });

  it("creates a habit with monthly schedules", async () => {
    const db = getDb();
    const result = await processCommand(db, {
      type: "CreateHabit",
      title: "Review",
      goal: {
        regularity: "month",
        schedules: [
          { hour: 9, minute: 0, dayOfMonth: 1 },
          { hour: 9, minute: 0, dayOfMonth: 15 },
        ],
      },
    });

    const habitId = result.habitId;
    const goals = await db
      .select()
      .from(schema.goal)
      .where(eq(schema.goal.habitId, habitId));
    expect(goals[0].frequency).toBe(2);

    const schedules = await db
      .select()
      .from(schema.schedule)
      .where(eq(schema.schedule.goalId, goals[0].id));
    expect(schedules).toHaveLength(2);
    expect(schedules[0].dayOfMonth).toBe(1);
    expect(schedules[1].dayOfMonth).toBe(15);
  });
});

describe("UpdateHabit", () => {
  it("updates the title", async () => {
    const db = getDb();
    const { habitId } = await processCommand(db, {
      type: "CreateHabit",
      title: "Old",
    });

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
    const { habitId } = await processCommand(db, {
      type: "CreateHabit",
      title: "Test",
      description: "Some desc",
    });

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
    const { habitId } = await processCommand(db, {
      type: "CreateHabit",
      title: "Test",
      description: "Keep me",
    });

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
    const { habitId } = await processCommand(db, {
      type: "CreateHabit",
      title: "Test",
      goal: { regularity: "day", frequency: 1 },
    });

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
    const { habitId } = await processCommand(db, {
      type: "CreateHabit",
      title: "Test",
      goal: { regularity: "day", frequency: 1 },
    });

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
    const { habitId } = await processCommand(db, {
      type: "CreateHabit",
      title: "Test",
      goal: { regularity: "day", frequency: 2 },
    });

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

  it("replaces frequency goal with scheduled goal", async () => {
    const db = getDb();
    const { habitId } = await processCommand(db, {
      type: "CreateHabit",
      title: "Test",
      goal: { regularity: "day", frequency: 1 },
    });

    await processCommand(db, {
      type: "UpdateHabit",
      habitId,
      goal: {
        regularity: "day",
        schedules: [
          { hour: 8, minute: 0 },
          { hour: 20, minute: 0 },
        ],
      },
    });

    const goals = await db
      .select()
      .from(schema.goal)
      .where(eq(schema.goal.habitId, habitId));
    expect(goals).toHaveLength(1);
    expect(goals[0].frequency).toBe(2);

    const schedules = await db
      .select()
      .from(schema.schedule)
      .where(eq(schema.schedule.goalId, goals[0].id));
    expect(schedules).toHaveLength(2);
  });

  it("replaces scheduled goal with frequency goal", async () => {
    const db = getDb();
    const { habitId } = await processCommand(db, {
      type: "CreateHabit",
      title: "Test",
      goal: {
        regularity: "day",
        schedules: [
          { hour: 8, minute: 0 },
          { hour: 20, minute: 0 },
        ],
      },
    });

    await processCommand(db, {
      type: "UpdateHabit",
      habitId,
      goal: { regularity: "day", frequency: 3 },
    });

    const goals = await db
      .select()
      .from(schema.goal)
      .where(eq(schema.goal.habitId, habitId));
    expect(goals).toHaveLength(1);
    expect(goals[0].frequency).toBe(3);

    const allSchedules = await db.select().from(schema.schedule);
    expect(allSchedules).toHaveLength(0);
  });

  it("deleting goal cascades to schedules", async () => {
    const db = getDb();
    const { habitId } = await processCommand(db, {
      type: "CreateHabit",
      title: "Test",
      goal: {
        regularity: "week",
        // Mon(2) + Thu(16) = 18
        schedules: [{ hour: 9, minute: 0, days: 18 }],
      },
    });

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

    const allSchedules = await db.select().from(schema.schedule);
    expect(allSchedules).toHaveLength(0);
  });
});

describe("DeleteHabit", () => {
  it("deletes the habit and cascades", async () => {
    const db = getDb();
    const { habitId } = await processCommand(db, {
      type: "CreateHabit",
      title: "Temp",
      goal: { regularity: "day", frequency: 1 },
    });

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

  it("cascades to schedules when deleting habit", async () => {
    const db = getDb();
    const { habitId } = await processCommand(db, {
      type: "CreateHabit",
      title: "Temp",
      goal: {
        regularity: "day",
        schedules: [
          { hour: 9, minute: 0 },
          { hour: 18, minute: 30 },
        ],
      },
    });

    await processCommand(db, { type: "DeleteHabit", habitId });

    const allSchedules = await db.select().from(schema.schedule);
    expect(allSchedules).toHaveLength(0);
  });
});

describe("CreateCheckIn", () => {
  it("creates a check-in for a habit", async () => {
    const db = getDb();
    const { habitId } = await processCommand(db, {
      type: "CreateHabit",
      title: "Test",
    });

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
    const { habitId } = await processCommand(db, {
      type: "CreateHabit",
      title: "Test",
    });

    const { checkInId } = await processCommand(db, {
      type: "CreateCheckIn",
      habitId,
    });

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
    const { habitId } = await processCommand(db, {
      type: "CreateHabit",
      title: "Setup",
    });

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
    const { habitId } = await processCommand(db, {
      type: "CreateHabit",
      title: "Multi",
    });

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
      // @ts-expect-error testing invalid command type
      processCommand(db, { type: "DoSomething" }),
    ).rejects.toThrow(ZodError);

    const logs = await db.select().from(schema.auditLog);
    expect(logs).toHaveLength(0);
  });

  it("rejects missing required field (no title)", async () => {
    const db = getDb();
    await expect(
      // @ts-expect-error testing missing required field
      processCommand(db, { type: "CreateHabit" }),
    ).rejects.toThrow(ZodError);

    const logs = await db.select().from(schema.auditLog);
    expect(logs).toHaveLength(0);
  });

  it("rejects wrong field type (string instead of number)", async () => {
    const db = getDb();
    await expect(
      // @ts-expect-error testing wrong field type
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
        // @ts-expect-error testing invalid enum value
        goal: { regularity: "year", frequency: 1 },
      }),
    ).rejects.toThrow(ZodError);

    const logs = await db.select().from(schema.auditLog);
    expect(logs).toHaveLength(0);
  });

  it("rejects goal with neither frequency nor schedules", async () => {
    const db = getDb();
    await expect(
      processCommand(db, {
        type: "CreateHabit",
        title: "X",
        goal: { regularity: "day" },
      }),
    ).rejects.toThrow(ZodError);
  });

  it("rejects goal with both frequency and schedules", async () => {
    const db = getDb();
    await expect(
      processCommand(db, {
        type: "CreateHabit",
        title: "X",
        goal: {
          regularity: "day",
          frequency: 2,
          schedules: [{ hour: 9, minute: 0 }],
        },
      }),
    ).rejects.toThrow(ZodError);
  });

  it("rejects daily schedule with days", async () => {
    const db = getDb();
    await expect(
      processCommand(db, {
        type: "CreateHabit",
        title: "X",
        goal: {
          regularity: "day",
          schedules: [{ hour: 9, minute: 0, days: 2 }],
        },
      }),
    ).rejects.toThrow(ZodError);
  });

  it("rejects weekly schedule without days", async () => {
    const db = getDb();
    await expect(
      processCommand(db, {
        type: "CreateHabit",
        title: "X",
        goal: {
          regularity: "week",
          schedules: [{ hour: 9, minute: 0 }],
        },
      }),
    ).rejects.toThrow(ZodError);
  });

  it("rejects monthly schedule without dayOfMonth", async () => {
    const db = getDb();
    await expect(
      processCommand(db, {
        type: "CreateHabit",
        title: "X",
        goal: {
          regularity: "month",
          schedules: [{ hour: 9, minute: 0 }],
        },
      }),
    ).rejects.toThrow(ZodError);
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
    // @ts-expect-error testing empty object input
    await expect(processCommand(db, {})).rejects.toThrow(ZodError);

    const logs = await db.select().from(schema.auditLog);
    expect(logs).toHaveLength(0);
  });

  it("rejects non-object input", async () => {
    const db = getDb();
    // @ts-expect-error testing non-object input
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
    const { habitId } = await processCommand(db, {
      type: "CreateHabit",
      title: "Valid",
    });

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

describe("schedule boundary values", () => {
  it("accepts schedule at midnight (hour 0, minute 0)", async () => {
    const db = getDb();
    const result = await processCommand(db, {
      type: "CreateHabit",
      title: "Midnight",
      goal: {
        regularity: "day",
        schedules: [{ hour: 0, minute: 0 }],
      },
    });

    const goals = await db
      .select()
      .from(schema.goal)
      .where(eq(schema.goal.habitId, result.habitId));
    const schedules = await db
      .select()
      .from(schema.schedule)
      .where(eq(schema.schedule.goalId, goals[0].id));
    expect(schedules[0].hour).toBe(0);
    expect(schedules[0].minute).toBe(0);
  });

  it("accepts schedule at end of day (hour 23, minute 59)", async () => {
    const db = getDb();
    const result = await processCommand(db, {
      type: "CreateHabit",
      title: "Late night",
      goal: {
        regularity: "day",
        schedules: [{ hour: 23, minute: 59 }],
      },
    });

    const goals = await db
      .select()
      .from(schema.goal)
      .where(eq(schema.goal.habitId, result.habitId));
    const schedules = await db
      .select()
      .from(schema.schedule)
      .where(eq(schema.schedule.goalId, goals[0].id));
    expect(schedules[0].hour).toBe(23);
    expect(schedules[0].minute).toBe(59);
  });
});

describe("UpdateHabit edge cases", () => {
  it("updates description from null to a value", async () => {
    const db = getDb();
    const { habitId } = await processCommand(db, {
      type: "CreateHabit",
      title: "No desc",
    });

    await processCommand(db, {
      type: "UpdateHabit",
      habitId,
      description: "Now it has one",
    });

    const [h] = await db
      .select()
      .from(schema.habit)
      .where(eq(schema.habit.id, habitId));
    expect(h.description).toBe("Now it has one");
  });

  it("can update only description without changing title", async () => {
    const db = getDb();
    const { habitId } = await processCommand(db, {
      type: "CreateHabit",
      title: "Keep me",
    });

    await processCommand(db, {
      type: "UpdateHabit",
      habitId,
      description: "Added desc",
    });

    const [h] = await db
      .select()
      .from(schema.habit)
      .where(eq(schema.habit.id, habitId));
    expect(h.title).toBe("Keep me");
    expect(h.description).toBe("Added desc");
  });
});

describe("multiple check-ins", () => {
  it("accumulates check-ins for the same habit", async () => {
    const db = getDb();
    const { habitId } = await processCommand(db, {
      type: "CreateHabit",
      title: "Multi",
    });

    await processCommand(db, { type: "CreateCheckIn", habitId });
    await processCommand(db, { type: "CreateCheckIn", habitId });
    await processCommand(db, { type: "CreateCheckIn", habitId });

    const checkIns = await db
      .select()
      .from(schema.checkIn)
      .where(eq(schema.checkIn.habitId, habitId));
    expect(checkIns).toHaveLength(3);
  });
});
