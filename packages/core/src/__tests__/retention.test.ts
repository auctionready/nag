import { describe, it, expect } from "vitest";
import * as schema from "@nag/schema";
import { setupTestDb } from "./testDb";
import { processCommand } from "../commands/processor";
import {
  previousMonthStart,
  pruneOldCheckIns,
  pruneOldCheckInsIfSafe,
} from "../retention";

const getDb = setupTestDb("retention-test.db");

describe("previousMonthStart", () => {
  it("returns the first of the previous month at UTC midnight", () => {
    const now = new Date("2026-04-27T15:30:00.000Z");
    expect(previousMonthStart(now).toISOString()).toBe(
      "2026-03-01T00:00:00.000Z",
    );
  });

  it("rolls into the prior year for January", () => {
    const now = new Date("2026-01-05T00:00:00.000Z");
    expect(previousMonthStart(now).toISOString()).toBe(
      "2025-12-01T00:00:00.000Z",
    );
  });

  it("normalises to UTC even for late-night local times", () => {
    const now = new Date("2026-03-01T01:00:00.000Z");
    expect(previousMonthStart(now).toISOString()).toBe(
      "2026-02-01T00:00:00.000Z",
    );
  });
});

describe("pruneOldCheckIns", () => {
  it("deletes check-ins older than the cutoff and keeps newer ones", async () => {
    const db = getDb();
    const { habitId } = await processCommand(db, {
      type: "CreateHabit",
      title: "Read",
    });

    const insertCheckIn = async (timestamp: Date) =>
      processCommand(db, { type: "CreateCheckIn", habitId, timestamp });

    await insertCheckIn(new Date("2026-01-15T08:00:00.000Z"));
    await insertCheckIn(new Date("2026-02-15T08:00:00.000Z"));
    await insertCheckIn(new Date("2026-03-15T08:00:00.000Z"));
    await insertCheckIn(new Date("2026-04-15T08:00:00.000Z"));

    await pruneOldCheckIns(db, new Date("2026-03-01T00:00:00.000Z"));

    const rows = await db.select().from(schema.checkIn);
    const timestamps = rows.map((r) => r.timestamp.toISOString()).sort();
    expect(timestamps).toEqual([
      "2026-03-15T08:00:00.000Z",
      "2026-04-15T08:00:00.000Z",
    ]);
  });

  it("is a no-op when no check-ins precede the cutoff", async () => {
    const db = getDb();
    const { habitId } = await processCommand(db, {
      type: "CreateHabit",
      title: "Read",
    });
    await processCommand(db, {
      type: "CreateCheckIn",
      habitId,
      timestamp: new Date("2026-04-01T08:00:00.000Z"),
    });

    await pruneOldCheckIns(db, new Date("2026-03-01T00:00:00.000Z"));

    const rows = await db.select().from(schema.checkIn);
    expect(rows).toHaveLength(1);
  });
});

describe("pruneOldCheckInsIfSafe", () => {
  it("prunes when the outbox is fully drained", async () => {
    const db = getDb();
    const { habitId } = await processCommand(db, {
      type: "CreateHabit",
      title: "Read",
    });
    await processCommand(db, {
      type: "CreateCheckIn",
      habitId,
      timestamp: new Date("2026-01-15T08:00:00.000Z"),
    });
    await processCommand(db, {
      type: "CreateCheckIn",
      habitId,
      timestamp: new Date("2026-04-15T08:00:00.000Z"),
    });

    // Mark every outbox row sent so the safety gate is satisfied.
    await db
      .update(schema.outbox)
      .set({ status: "sent", sentAt: new Date(), serverSequence: 1 });

    const ran = await pruneOldCheckInsIfSafe(
      db,
      new Date("2026-04-27T00:00:00.000Z"),
    );
    expect(ran).toBe(true);

    const rows = await db.select().from(schema.checkIn);
    expect(rows).toHaveLength(1);
    expect(rows[0].timestamp.toISOString()).toBe("2026-04-15T08:00:00.000Z");
  });

  it("skips when there are pending outbox rows", async () => {
    const db = getDb();
    const { habitId } = await processCommand(db, {
      type: "CreateHabit",
      title: "Read",
    });
    await processCommand(db, {
      type: "CreateCheckIn",
      habitId,
      timestamp: new Date("2026-01-15T08:00:00.000Z"),
    });
    // Outbox left as `pending` — the safety gate should refuse.

    const ran = await pruneOldCheckInsIfSafe(
      db,
      new Date("2026-04-27T00:00:00.000Z"),
    );
    expect(ran).toBe(false);

    const rows = await db.select().from(schema.checkIn);
    expect(rows).toHaveLength(1);
  });

  it("skips when there are failed outbox rows", async () => {
    const db = getDb();
    const { habitId } = await processCommand(db, {
      type: "CreateHabit",
      title: "Read",
    });
    await processCommand(db, {
      type: "CreateCheckIn",
      habitId,
      timestamp: new Date("2026-01-15T08:00:00.000Z"),
    });

    await db.update(schema.outbox).set({ status: "failed", lastError: "test" });

    const ran = await pruneOldCheckInsIfSafe(
      db,
      new Date("2026-04-27T00:00:00.000Z"),
    );
    expect(ran).toBe(false);

    const rows = await db.select().from(schema.checkIn);
    expect(rows).toHaveLength(1);
  });
});
