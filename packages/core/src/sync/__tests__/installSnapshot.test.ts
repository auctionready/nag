import { describe, it, expect } from "vitest";
import { eq } from "drizzle-orm";
import * as schema from "@nag/schema";
import { setupTestDb } from "../../__tests__/testDb";
import { installSnapshot, type ServerSnapshot } from "../installSnapshot";
import { processCommand } from "../../commands/processor";

const getDb = setupTestDb("install-snapshot-test.db");

const habitId = "11111111-1111-4111-8111-111111111111";
const checkInId = "22222222-2222-4222-8222-222222222222";

const sampleSnapshot: ServerSnapshot = {
  habits: [
    {
      id: habitId,
      title: "Read",
      description: null,
      icon: null,
      goal: { regularity: "day", frequency: 1 },
      schedules: [
        { hour: 7, minute: 0, days: 127, dayOfMonth: null, reminder: true },
      ],
      periodCheckIns: [
        {
          id: checkInId,
          timestamp: "2026-04-25T07:00:00.000Z",
          skipped: false,
        },
      ],
    },
  ],
};

describe("installSnapshot", () => {
  it("populates replicated tables with snapshot contents", async () => {
    const db = getDb();
    await installSnapshot(db, 17, sampleSnapshot);

    const [h] = await db.select().from(schema.habit);
    expect(h.externalId).toBe(habitId);
    expect(h.title).toBe("Read");

    const [g] = await db.select().from(schema.goal);
    expect(g.regularity).toBe("day");

    const sched = await db.select().from(schema.schedule);
    expect(sched).toHaveLength(1);
    expect(sched[0].hour).toBe(7);

    const ci = await db.select().from(schema.checkIn);
    expect(ci).toHaveLength(1);
    expect(ci[0].externalId).toBe(checkInId);
  });

  it("flushes pre-existing replicated rows", async () => {
    const db = getDb();
    // Pre-populate via processCommand so the rows look real (and seed
    // a pending outbox row in the process).
    await processCommand(db, { type: "CreateHabit", title: "Old habit" });
    expect(await db.select().from(schema.habit)).toHaveLength(1);

    await installSnapshot(db, 50, sampleSnapshot);

    const habits = await db.select().from(schema.habit);
    expect(habits).toHaveLength(1);
    expect(habits[0].externalId).toBe(habitId);
    expect(habits[0].title).toBe("Read");
  });

  it("clears the outbox", async () => {
    const db = getDb();
    await processCommand(db, { type: "CreateHabit", title: "Pending" });
    expect(await db.select().from(schema.outbox)).not.toHaveLength(0);

    await installSnapshot(db, 50, sampleSnapshot);
    expect(await db.select().from(schema.outbox)).toHaveLength(0);
  });

  it("clears halted and advances highest_server_sequence to sequenceAtSnapshot", async () => {
    const db = getDb();
    await db
      .update(schema.syncState)
      .set({ halted: true })
      .where(eq(schema.syncState.id, 1));

    await installSnapshot(db, 99, sampleSnapshot);

    const [s] = await db
      .select()
      .from(schema.syncState)
      .where(eq(schema.syncState.id, 1));
    expect(s.halted).toBe(false);
    expect(s.highestServerSequence).toBe(99);
  });

  it("handles empty snapshot", async () => {
    const db = getDb();
    await processCommand(db, { type: "CreateHabit", title: "Will be wiped" });

    await installSnapshot(db, 5, { habits: [] });

    expect(await db.select().from(schema.habit)).toHaveLength(0);
    expect(await db.select().from(schema.outbox)).toHaveLength(0);
  });

  it("handles habit with no goal", async () => {
    const db = getDb();
    await installSnapshot(db, 1, {
      habits: [
        {
          id: habitId,
          title: "Stretch",
          description: null,
          icon: null,
          goal: null,
          schedules: null,
          periodCheckIns: null,
        },
      ],
    });

    expect(await db.select().from(schema.habit)).toHaveLength(1);
    expect(await db.select().from(schema.goal)).toHaveLength(0);
    expect(await db.select().from(schema.schedule)).toHaveLength(0);
  });
});
