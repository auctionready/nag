import { describe, it, expect } from "vitest";
import { eq } from "drizzle-orm";
import * as schema from "@nag/schema";
import { setupTestDb } from "../../__tests__/testDb";
import { applyServerCommand, type ServerCommand } from "../applyServerCommand";

const getDb = setupTestDb("apply-server-command-test.db");

const habitExternalId = "11111111-1111-4111-8111-111111111111";
const checkInExternalId = "22222222-2222-4222-8222-222222222222";

const createHabit = (sequence = 1): ServerCommand => ({
  sequence,
  id: "envelope-1",
  type: "CreateHabit",
  payload: {
    habitId: habitExternalId,
    title: "Read",
    description: null,
    icon: null,
    goal: { regularity: "day", frequency: 1, schedules: null },
  },
});

describe("applyServerCommand CreateHabit", () => {
  it("inserts the habit and goal keyed by external_id", async () => {
    const db = getDb();
    await applyServerCommand(db, createHabit());

    const [row] = await db.select().from(schema.habit);
    expect(row.externalId).toBe(habitExternalId);
    expect(row.title).toBe("Read");

    const [g] = await db.select().from(schema.goal);
    expect(g.regularity).toBe("day");
  });

  it("does not write to outbox", async () => {
    const db = getDb();
    await applyServerCommand(db, createHabit());

    const rows = await db.select().from(schema.outbox);
    expect(rows).toHaveLength(0);
  });

  it("advances highest_server_sequence", async () => {
    const db = getDb();
    await applyServerCommand(db, createHabit(42));

    const [row] = await db
      .select({ value: schema.syncState.highestServerSequence })
      .from(schema.syncState)
      .where(eq(schema.syncState.id, 1));
    expect(row.value).toBe(42);
  });

  it("never lowers highest_server_sequence on out-of-order replay", async () => {
    const db = getDb();
    await applyServerCommand(db, createHabit(100));
    // Now apply something with a smaller sequence — high-water mark
    // shouldn't slide backwards.
    await applyServerCommand(db, {
      ...createHabit(5),
      payload: {
        habitId: "33333333-3333-4333-8333-333333333333",
        title: "Other",
        description: null,
        icon: null,
        goal: null,
      },
    });
    const [row] = await db
      .select({ value: schema.syncState.highestServerSequence })
      .from(schema.syncState)
      .where(eq(schema.syncState.id, 1));
    expect(row.value).toBe(100);
  });

  it("is idempotent: re-applying upserts in place", async () => {
    const db = getDb();
    await applyServerCommand(db, createHabit());
    await applyServerCommand(db, createHabit());

    const habits = await db.select().from(schema.habit);
    expect(habits).toHaveLength(1);
  });
});

describe("applyServerCommand UpdateHabit", () => {
  it("updates the title in place", async () => {
    const db = getDb();
    await applyServerCommand(db, createHabit(1));
    await applyServerCommand(db, {
      sequence: 2,
      type: "UpdateHabit",
      payload: { habitId: habitExternalId, title: "Read more" },
    });

    const [row] = await db.select().from(schema.habit);
    expect(row.title).toBe("Read more");
  });

  it("clearDescription wipes description to null", async () => {
    const db = getDb();
    await applyServerCommand(db, {
      sequence: 1,
      type: "CreateHabit",
      payload: {
        habitId: habitExternalId,
        title: "Read",
        description: "with focus",
        goal: null,
      },
    });
    await applyServerCommand(db, {
      sequence: 2,
      type: "UpdateHabit",
      payload: { habitId: habitExternalId, clearDescription: true },
    });

    const [row] = await db.select().from(schema.habit);
    expect(row.description).toBeNull();
  });

  it("clearGoal removes the goal and its schedules", async () => {
    const db = getDb();
    await applyServerCommand(db, {
      sequence: 1,
      type: "CreateHabit",
      payload: {
        habitId: habitExternalId,
        title: "Read",
        goal: {
          regularity: "day",
          frequency: 1,
          schedules: [
            { hour: 7, minute: 0, days: 127, dayOfMonth: null, reminder: true },
          ],
        },
      },
    });
    await applyServerCommand(db, {
      sequence: 2,
      type: "UpdateHabit",
      payload: { habitId: habitExternalId, clearGoal: true },
    });

    expect(await db.select().from(schema.goal)).toHaveLength(0);
    expect(await db.select().from(schema.schedule)).toHaveLength(0);
  });

  it("tolerates missing target as a no-op", async () => {
    const db = getDb();
    await applyServerCommand(db, {
      sequence: 1,
      type: "UpdateHabit",
      payload: { habitId: habitExternalId, title: "Ghost" },
    });
    expect(await db.select().from(schema.habit)).toHaveLength(0);
  });
});

describe("applyServerCommand DeleteHabit", () => {
  it("removes the habit", async () => {
    const db = getDb();
    await applyServerCommand(db, createHabit(1));
    await applyServerCommand(db, {
      sequence: 2,
      type: "DeleteHabit",
      payload: { habitId: habitExternalId },
    });
    expect(await db.select().from(schema.habit)).toHaveLength(0);
  });

  it("tolerates missing target as a no-op", async () => {
    const db = getDb();
    await applyServerCommand(db, {
      sequence: 1,
      type: "DeleteHabit",
      payload: { habitId: habitExternalId },
    });
    expect(await db.select().from(schema.habit)).toHaveLength(0);
  });
});

describe("applyServerCommand CreateCheckIn", () => {
  it("inserts a check-in keyed by external_id", async () => {
    const db = getDb();
    await applyServerCommand(db, createHabit(1));
    await applyServerCommand(db, {
      sequence: 2,
      type: "CreateCheckIn",
      payload: {
        checkInId: checkInExternalId,
        habitId: habitExternalId,
        timestamp: "2026-04-25T07:00:00.000Z",
        skipped: false,
      },
    });

    const [row] = await db.select().from(schema.checkIn);
    expect(row.externalId).toBe(checkInExternalId);
    expect(row.skipped).toBe(false);
  });

  it("drops the check-in when habit is missing locally (UpdateHabit-after-DeleteHabit class)", async () => {
    const db = getDb();
    await applyServerCommand(db, {
      sequence: 1,
      type: "CreateCheckIn",
      payload: {
        checkInId: checkInExternalId,
        habitId: habitExternalId,
        timestamp: "2026-04-25T07:00:00.000Z",
        skipped: false,
      },
    });
    expect(await db.select().from(schema.checkIn)).toHaveLength(0);
  });

  it("upserts on re-apply", async () => {
    const db = getDb();
    await applyServerCommand(db, createHabit(1));
    const cmd: ServerCommand = {
      sequence: 2,
      type: "CreateCheckIn",
      payload: {
        checkInId: checkInExternalId,
        habitId: habitExternalId,
        timestamp: "2026-04-25T07:00:00.000Z",
        skipped: false,
      },
    };
    await applyServerCommand(db, cmd);
    await applyServerCommand(db, cmd);
    expect(await db.select().from(schema.checkIn)).toHaveLength(1);
  });
});

describe("applyServerCommand UpdateCheckIn", () => {
  it("updates timestamp on existing check-in", async () => {
    const db = getDb();
    await applyServerCommand(db, createHabit(1));
    await applyServerCommand(db, {
      sequence: 2,
      type: "CreateCheckIn",
      payload: {
        checkInId: checkInExternalId,
        habitId: habitExternalId,
        timestamp: "2026-04-25T07:00:00.000Z",
        skipped: false,
      },
    });
    await applyServerCommand(db, {
      sequence: 3,
      type: "UpdateCheckIn",
      payload: {
        checkInId: checkInExternalId,
        timestamp: "2026-04-25T08:00:00.000Z",
        skipped: true,
      },
    });

    const [row] = await db.select().from(schema.checkIn);
    expect(row.skipped).toBe(true);
  });

  it("tolerates missing target as a no-op", async () => {
    const db = getDb();
    await applyServerCommand(db, {
      sequence: 1,
      type: "UpdateCheckIn",
      payload: {
        checkInId: checkInExternalId,
        timestamp: "2026-04-25T07:00:00.000Z",
        skipped: false,
      },
    });
    expect(await db.select().from(schema.checkIn)).toHaveLength(0);
  });
});

describe("applyServerCommand DeleteCheckIn", () => {
  it("removes the check-in by external_id", async () => {
    const db = getDb();
    await applyServerCommand(db, createHabit(1));
    await applyServerCommand(db, {
      sequence: 2,
      type: "CreateCheckIn",
      payload: {
        checkInId: checkInExternalId,
        habitId: habitExternalId,
        timestamp: "2026-04-25T07:00:00.000Z",
        skipped: false,
      },
    });
    await applyServerCommand(db, {
      sequence: 3,
      type: "DeleteCheckIn",
      payload: { checkInId: checkInExternalId },
    });
    expect(await db.select().from(schema.checkIn)).toHaveLength(0);
  });
});

describe("applyServerCommand transactional safety", () => {
  it("rollback on unknown type leaves DB untouched", async () => {
    const db = getDb();
    await applyServerCommand(db, createHabit(1));

    await expect(
      applyServerCommand(db, {
        sequence: 2,
        type: "Unknown",
        payload: {},
      }),
    ).rejects.toThrow(/unknown envelope type/);

    // Original habit still present, sequence still 1.
    expect(await db.select().from(schema.habit)).toHaveLength(1);
    const [s] = await db
      .select({ value: schema.syncState.highestServerSequence })
      .from(schema.syncState)
      .where(eq(schema.syncState.id, 1));
    expect(s.value).toBe(1);
  });
});
