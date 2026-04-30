import { describe, it, expect, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import * as schema from "@nag/schema";
import { ZodError } from "zod";
import type { AnyDb } from "../db";
import { processCommand } from "../commands/processor";
import { setupTestDb } from "./testDb";
import { Day } from "../days";

const getDb = setupTestDb("commands-test.db");

/** Test helper: dispatch a CreateCheckIn command with sensible defaults. */
const createCheckIn = (
  db: AnyDb,
  habitId: number,
  options: { timestamp?: Date; skipped?: boolean } = {},
) =>
  processCommand(db, {
    type: "CreateCheckIn",
    habitId,
    timestamp: options.timestamp ?? new Date(),
    ...(options.skipped !== undefined ? { skipped: options.skipped } : {}),
  });

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
    const result = await processCommand(db, {
      type: "CreateHabit",
      title: "Exercise",
      goal: {
        regularity: "week",
        schedules: [{ hour: 7, minute: 0, days: Day.Mon | Day.Wed | Day.Fri }],
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
    expect(schedules[0].days).toBe(Day.Mon | Day.Wed | Day.Fri);
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
        schedules: [{ hour: 9, minute: 0, days: Day.Mon | Day.Thu }],
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

    await createCheckIn(db, habitId);

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

    const now = new Date();
    const result = await createCheckIn(db, habitId, { timestamp: now });

    expect(result).toHaveProperty("checkInId");
    const checkIns = await db
      .select()
      .from(schema.checkIn)
      .where(eq(schema.checkIn.habitId, habitId));
    expect(checkIns).toHaveLength(1);
    // `timestamp` is the deemed slot (from the payload); `createdAt` is the
    // wall-clock insert time. For a same-moment check-in they're both ≈ `now`.
    expect(checkIns[0].timestamp.getTime()).toBe(now.getTime());
    expect(checkIns[0].createdAt).toBeInstanceOf(Date);
  });

  it("stores payload timestamp separately from createdAt for back-filled slots", async () => {
    const db = getDb();
    const { habitId } = await processCommand(db, {
      type: "CreateHabit",
      title: "Back-fill test",
    });

    const eightAmYesterday = new Date();
    eightAmYesterday.setDate(eightAmYesterday.getDate() - 1);
    eightAmYesterday.setHours(8, 0, 0, 0);
    const beforeInsert = Date.now();

    await createCheckIn(db, habitId, { timestamp: eightAmYesterday });

    const [row] = await db
      .select()
      .from(schema.checkIn)
      .where(eq(schema.checkIn.habitId, habitId));
    expect(row.timestamp.getTime()).toBe(eightAmYesterday.getTime());
    expect(row.createdAt.getTime()).toBeGreaterThanOrEqual(beforeInsert);
    expect(row.createdAt.getTime()).toBeGreaterThan(row.timestamp.getTime());
  });
});

describe("DeleteCheckIn", () => {
  it("deletes a specific check-in", async () => {
    const db = getDb();
    const { habitId } = await processCommand(db, {
      type: "CreateHabit",
      title: "Test",
    });

    const { checkInId } = await createCheckIn(db, habitId);

    await createCheckIn(db, habitId);

    await processCommand(db, { type: "DeleteCheckIn", checkInId });

    const checkIns = await db
      .select()
      .from(schema.checkIn)
      .where(eq(schema.checkIn.habitId, habitId));
    expect(checkIns).toHaveLength(1);
  });
});

describe("audit logging", () => {
  it("records a server-shaped event envelope for each command", async () => {
    const db = getDb();
    const { externalId } = await processCommand(db, {
      type: "CreateHabit",
      title: "Audit test",
      goal: { regularity: "week", frequency: 2 },
    });

    const logs = await db.select().from(schema.outbox);
    expect(logs).toHaveLength(1);
    expect(logs[0].timestamp).toBeInstanceOf(Date);
    expect(logs[0].status).toBe("pending");
    expect(logs[0].envelopeId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );

    const events = JSON.parse(logs[0].events) as Array<{
      type: string;
      payload: Record<string, unknown>;
    }>;
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("HabitCreated");
    expect(events[0].payload.habitId).toBe(externalId);
    expect(events[0].payload.title).toBe("Audit test");
    expect(events[0].payload.description).toBeNull();
    expect(events[0].payload.icon).toBeNull();
    expect(events[0].payload.goal).toEqual({
      regularity: "week",
      frequency: 2,
      schedules: null,
    });
  });

  it("emits the habit's externalId for DeleteHabit", async () => {
    const db = getDb();
    const { habitId, externalId } = await processCommand(db, {
      type: "CreateHabit",
      title: "Setup",
    });

    await processCommand(db, { type: "DeleteHabit", habitId });

    const logs = await db.select().from(schema.outbox);
    const deleteLog = logs.find((l) => {
      const events = JSON.parse(l.events) as Array<{ type: string }>;
      return events.some((e) => e.type === "HabitDeleted");
    });
    expect(deleteLog).toBeDefined();
    const events = JSON.parse(deleteLog!.events) as Array<{
      type: string;
      payload: { habitId: string };
    }>;
    expect(events[0].payload.habitId).toBe(externalId);
  });

  it("does not audit on validation failure", async () => {
    const db = getDb();
    await expect(
      processCommand(db, { type: "CreateHabit", title: "" }),
    ).rejects.toThrow();

    const logs = await db.select().from(schema.outbox);
    expect(logs).toHaveLength(0);
  });

  it("accumulates audit entries across commands", async () => {
    const db = getDb();
    const { habitId } = await processCommand(db, {
      type: "CreateHabit",
      title: "Multi",
    });

    await createCheckIn(db, habitId);
    await processCommand(db, {
      type: "UpdateHabit",
      habitId,
      title: "Updated",
    });

    const logs = await db.select().from(schema.outbox);
    expect(logs).toHaveLength(3);
    const types = logs.map((l) => {
      const events = JSON.parse(l.events) as Array<{ type: string }>;
      return events.map((e) => e.type).join(",");
    });
    expect(types).toEqual([
      "HabitCreated",
      "CheckInRecorded",
      "HabitDetailsEdited",
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

    const logs = await db.select().from(schema.outbox);
    expect(logs).toHaveLength(0);
  });

  it("rejects missing required field (no title)", async () => {
    const db = getDb();
    await expect(
      // @ts-expect-error testing missing required field
      processCommand(db, { type: "CreateHabit" }),
    ).rejects.toThrow(ZodError);

    const logs = await db.select().from(schema.outbox);
    expect(logs).toHaveLength(0);
  });

  it("rejects wrong field type (string instead of number)", async () => {
    const db = getDb();
    await expect(
      // @ts-expect-error testing wrong field type
      processCommand(db, { type: "DeleteHabit", habitId: "abc" }),
    ).rejects.toThrow(ZodError);

    const logs = await db.select().from(schema.outbox);
    expect(logs).toHaveLength(0);
  });

  it("rejects negative id", async () => {
    const db = getDb();
    await expect(
      processCommand(db, {
        type: "CreateCheckIn",
        habitId: -1,
        timestamp: new Date(),
      }),
    ).rejects.toThrow(ZodError);

    const logs = await db.select().from(schema.outbox);
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

    const logs = await db.select().from(schema.outbox);
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

    const logs = await db.select().from(schema.outbox);
    expect(logs).toHaveLength(0);
  });

  it("rejects empty object input", async () => {
    const db = getDb();
    // @ts-expect-error testing empty object input
    await expect(processCommand(db, {})).rejects.toThrow(ZodError);

    const logs = await db.select().from(schema.outbox);
    expect(logs).toHaveLength(0);
  });

  it("rejects non-object input", async () => {
    const db = getDb();
    // @ts-expect-error testing non-object input
    await expect(processCommand(db, "hello")).rejects.toThrow(ZodError);

    const logs = await db.select().from(schema.outbox);
    expect(logs).toHaveLength(0);
  });
});

describe("processCommand handler errors", () => {
  it("throws on FK violation (check-in for non-existent habit)", async () => {
    const db = getDb();
    await expect(
      processCommand(db, {
        type: "CreateCheckIn",
        habitId: 99999,
        timestamp: new Date(),
      }),
    ).rejects.toThrow();

    const logs = await db.select().from(schema.outbox);
    expect(logs).toHaveLength(0);
  });

  it("does not leave partial data after handler error", async () => {
    const db = getDb();
    const habitsBefore = await db.select().from(schema.habit);
    const checkInsBefore = await db.select().from(schema.checkIn);

    await expect(
      processCommand(db, {
        type: "CreateCheckIn",
        habitId: 99999,
        timestamp: new Date(),
      }),
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

    await db.delete(schema.outbox);

    await expect(
      processCommand(db, {
        type: "CreateCheckIn",
        habitId: 99999,
        timestamp: new Date(),
      }),
    ).rejects.toThrow();

    const logs = await db.select().from(schema.outbox);
    expect(logs).toHaveLength(0);

    const habits = await db
      .select()
      .from(schema.habit)
      .where(eq(schema.habit.id, habitId));
    expect(habits).toHaveLength(1);
  });
});

describe("schedule boundary values", () => {
  describe("at midnight (hour 0, minute 0)", () => {
    let schedules: { hour: number; minute: number }[];

    beforeEach(async () => {
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
      schedules = await db
        .select()
        .from(schema.schedule)
        .where(eq(schema.schedule.goalId, goals[0].id));
    });

    it("stores hour as 0", () => {
      expect(schedules[0].hour).toBe(0);
    });

    it("stores minute as 0", () => {
      expect(schedules[0].minute).toBe(0);
    });
  });

  describe("at end of day (hour 23, minute 59)", () => {
    let schedules: { hour: number; minute: number }[];

    beforeEach(async () => {
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
      schedules = await db
        .select()
        .from(schema.schedule)
        .where(eq(schema.schedule.goalId, goals[0].id));
    });

    it("stores hour as 23", () => {
      expect(schedules[0].hour).toBe(23);
    });

    it("stores minute as 59", () => {
      expect(schedules[0].minute).toBe(59);
    });
  });
});

describe("UpdateHabit description edge cases", () => {
  describe("adding description to habit without one", () => {
    let habit: { title: string; description: string | null };

    beforeEach(async () => {
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
      [habit] = await db
        .select()
        .from(schema.habit)
        .where(eq(schema.habit.id, habitId));
    });

    it("sets the description", () => {
      expect(habit.description).toBe("Now it has one");
    });
  });

  describe("updating only description without title", () => {
    let habit: { title: string; description: string | null };

    beforeEach(async () => {
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
      [habit] = await db
        .select()
        .from(schema.habit)
        .where(eq(schema.habit.id, habitId));
    });

    it("preserves the title", () => {
      expect(habit.title).toBe("Keep me");
    });

    it("sets the description", () => {
      expect(habit.description).toBe("Added desc");
    });
  });
});

describe("multiple check-ins", () => {
  let checkIns: unknown[];

  beforeEach(async () => {
    const db = getDb();
    const { habitId } = await processCommand(db, {
      type: "CreateHabit",
      title: "Multi",
    });
    await createCheckIn(db, habitId);
    await createCheckIn(db, habitId);
    await createCheckIn(db, habitId);
    checkIns = await db
      .select()
      .from(schema.checkIn)
      .where(eq(schema.checkIn.habitId, habitId));
  });

  it("accumulates all check-ins for the same habit", () => {
    expect(checkIns).toHaveLength(3);
  });
});
