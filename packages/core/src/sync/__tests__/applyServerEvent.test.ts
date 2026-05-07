import { describe, it, expect } from "vitest";
import { eq } from "drizzle-orm";
import * as schema from "@nag/schema";
import { setupTestDb } from "../../__tests__/testDb";
import { applyServerEvent, type ServerEvent } from "../applyServerEvent";

const getDb = setupTestDb("apply-server-event-test.db");

const habitExtId = "11111111-1111-4111-8111-111111111111";
const checkInExtId = "22222222-2222-4222-8222-222222222222";

const habitCreated = (sequence = 1, extra: object = {}): ServerEvent => ({
  sequence,
  type: "HabitCreated",
  payload: { habitId: habitExtId, title: "Read", ...extra },
});

describe("applyServerEvent HabitCreated", () => {
  it("inserts the habit", async () => {
    const db = getDb();
    await applyServerEvent(db, habitCreated());
    const rows = await db.select().from(schema.habit);
    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe("Read");
    expect(rows[0].externalId).toBe(habitExtId);
  });

  it("is idempotent on replay", async () => {
    const db = getDb();
    await applyServerEvent(db, habitCreated());
    await applyServerEvent(db, habitCreated());
    expect(await db.select().from(schema.habit)).toHaveLength(1);
  });

  it("advances highest_server_sequence to the envelope's sequence", async () => {
    const db = getDb();
    await applyServerEvent(db, habitCreated(42));
    const [s] = await db
      .select({ value: schema.syncState.highestServerSequence })
      .from(schema.syncState)
      .where(eq(schema.syncState.id, 1));
    expect(s.value).toBe(42);
  });

  it("MAX-merges sequence so out-of-order replay never regresses", async () => {
    const db = getDb();
    await applyServerEvent(db, habitCreated(100));
    await applyServerEvent(db, {
      sequence: 5,
      type: "HabitCreated",
      payload: {
        habitId: "33333333-3333-4333-8333-333333333333",
        title: "Other",
      },
    });
    const [s] = await db
      .select({ value: schema.syncState.highestServerSequence })
      .from(schema.syncState)
      .where(eq(schema.syncState.id, 1));
    expect(s.value).toBe(100);
  });
});

describe("applyServerEvent HabitDetailsEdited", () => {
  it("updates title", async () => {
    const db = getDb();
    await applyServerEvent(db, habitCreated());
    await applyServerEvent(db, {
      sequence: 2,
      type: "HabitDetailsEdited",
      payload: { habitId: habitExtId, title: "Read more" },
    });
    const [h] = await db.select().from(schema.habit);
    expect(h.title).toBe("Read more");
  });

  it("clears description with clearDescription", async () => {
    const db = getDb();
    await applyServerEvent(db, habitCreated(1, { description: "Daily" }));
    await applyServerEvent(db, {
      sequence: 2,
      type: "HabitDetailsEdited",
      payload: { habitId: habitExtId, clearDescription: true },
    });
    const [h] = await db.select().from(schema.habit);
    expect(h.description).toBeNull();
  });

  it("no-ops when target habit is missing", async () => {
    const db = getDb();
    await applyServerEvent(db, {
      sequence: 1,
      type: "HabitDetailsEdited",
      payload: { habitId: habitExtId, title: "Ghost" },
    });
    expect(await db.select().from(schema.habit)).toHaveLength(0);
  });
});

describe("applyServerEvent HabitGoalDefined / HabitGoalCleared", () => {
  it("Defined writes goal + schedules", async () => {
    const db = getDb();
    await applyServerEvent(db, habitCreated());
    await applyServerEvent(db, {
      sequence: 2,
      type: "HabitGoalDefined",
      payload: {
        habitId: habitExtId,
        regularity: "day",
        frequency: 1,
        schedules: null,
      },
    });
    const [g] = await db.select().from(schema.goal);
    expect(g.regularity).toBe("day");
    expect(g.frequency).toBe(1);
  });

  it("Cleared removes the goal (cascades schedules)", async () => {
    const db = getDb();
    await applyServerEvent(db, habitCreated());
    await applyServerEvent(db, {
      sequence: 2,
      type: "HabitGoalDefined",
      payload: {
        habitId: habitExtId,
        regularity: "day",
        frequency: 1,
        schedules: null,
      },
    });
    await applyServerEvent(db, {
      sequence: 3,
      type: "HabitGoalCleared",
      payload: { habitId: habitExtId },
    });
    expect(await db.select().from(schema.goal)).toHaveLength(0);
  });
});

describe("applyServerEvent HabitDeleted", () => {
  it("removes the habit (cascades children)", async () => {
    const db = getDb();
    await applyServerEvent(db, habitCreated());
    await applyServerEvent(db, {
      sequence: 2,
      type: "HabitDeleted",
      payload: { habitId: habitExtId },
    });
    expect(await db.select().from(schema.habit)).toHaveLength(0);
  });
});

describe("applyServerEvent CheckInRecorded", () => {
  it("inserts a check-in for the matching habit", async () => {
    const db = getDb();
    await applyServerEvent(db, habitCreated());
    await applyServerEvent(db, {
      sequence: 2,
      type: "CheckInRecorded",
      payload: {
        checkInId: checkInExtId,
        habitId: habitExtId,
        timestamp: "2026-04-25T07:00:00.000Z",
        skipped: false,
      },
    });
    const [c] = await db.select().from(schema.checkIn);
    expect(c.externalId).toBe(checkInExtId);
    expect(c.timestamp.toISOString()).toBe("2026-04-25T07:00:00.000Z");
  });

  it("drops the check-in when the habit is missing locally", async () => {
    const db = getDb();
    await applyServerEvent(db, {
      sequence: 1,
      type: "CheckInRecorded",
      payload: {
        checkInId: checkInExtId,
        habitId: habitExtId,
        timestamp: "2026-04-25T07:00:00.000Z",
      },
    });
    expect(await db.select().from(schema.checkIn)).toHaveLength(0);
  });

  it("is idempotent on replay", async () => {
    const db = getDb();
    await applyServerEvent(db, habitCreated());
    const event: ServerEvent = {
      sequence: 2,
      type: "CheckInRecorded",
      payload: {
        checkInId: checkInExtId,
        habitId: habitExtId,
        timestamp: "2026-04-25T07:00:00.000Z",
      },
    };
    await applyServerEvent(db, event);
    await applyServerEvent(db, event);
    expect(await db.select().from(schema.checkIn)).toHaveLength(1);
  });
});

describe("applyServerEvent CheckInMoved", () => {
  it("updates the timestamp on the existing check-in", async () => {
    const db = getDb();
    await applyServerEvent(db, habitCreated());
    await applyServerEvent(db, {
      sequence: 2,
      type: "CheckInRecorded",
      payload: {
        checkInId: checkInExtId,
        habitId: habitExtId,
        timestamp: "2026-04-25T07:00:00.000Z",
      },
    });
    await applyServerEvent(db, {
      sequence: 3,
      type: "CheckInMoved",
      payload: {
        checkInId: checkInExtId,
        habitId: habitExtId,
        oldTimestamp: "2026-04-25T07:00:00.000Z",
        newTimestamp: "2026-04-25T08:00:00.000Z",
      },
    });
    const [c] = await db.select().from(schema.checkIn);
    expect(c.timestamp.toISOString()).toBe("2026-04-25T08:00:00.000Z");
  });
});

describe("applyServerEvent CheckInMarkedSkipped / CheckInMarkedDone", () => {
  it("flips skipped to true / false", async () => {
    const db = getDb();
    await applyServerEvent(db, habitCreated());
    await applyServerEvent(db, {
      sequence: 2,
      type: "CheckInRecorded",
      payload: {
        checkInId: checkInExtId,
        habitId: habitExtId,
        timestamp: "2026-04-25T07:00:00.000Z",
      },
    });
    await applyServerEvent(db, {
      sequence: 3,
      type: "CheckInMarkedSkipped",
      payload: {
        checkInId: checkInExtId,
        habitId: habitExtId,
        timestamp: "2026-04-25T07:00:00.000Z",
      },
    });
    expect((await db.select().from(schema.checkIn))[0].skipped).toBe(true);
    await applyServerEvent(db, {
      sequence: 4,
      type: "CheckInMarkedDone",
      payload: {
        checkInId: checkInExtId,
        habitId: habitExtId,
        timestamp: "2026-04-25T07:00:00.000Z",
      },
    });
    expect((await db.select().from(schema.checkIn))[0].skipped).toBe(false);
  });
});

describe("applyServerEvent CheckInDeleted", () => {
  it("removes the check-in", async () => {
    const db = getDb();
    await applyServerEvent(db, habitCreated());
    await applyServerEvent(db, {
      sequence: 2,
      type: "CheckInRecorded",
      payload: {
        checkInId: checkInExtId,
        habitId: habitExtId,
        timestamp: "2026-04-25T07:00:00.000Z",
      },
    });
    await applyServerEvent(db, {
      sequence: 3,
      type: "CheckInDeleted",
      payload: {
        checkInId: checkInExtId,
        habitId: habitExtId,
        timestamp: "2026-04-25T07:00:00.000Z",
      },
    });
    expect(await db.select().from(schema.checkIn)).toHaveLength(0);
  });
});

describe("applyServerEvent unknown type", () => {
  it("throws", async () => {
    const db = getDb();
    await expect(
      applyServerEvent(db, {
        sequence: 1,
        type: "NoSuchEvent",
        payload: {},
      }),
    ).rejects.toThrow("unknown event type");
  });
});
