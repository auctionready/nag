import { describe, it, expect } from "vitest";
import * as schema from "@nag/schema";
import { setupTestDb } from "./testDb";
import { processCommand } from "../commands/processor";
import {
  currentWeekBounds,
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

describe("currentWeekBounds", () => {
  // 2026-04-24 is a Friday.
  const friday = new Date("2026-04-24T14:30:00.000Z");

  it("defaults to a Monday-anchored week", () => {
    const { start, end } = currentWeekBounds(friday);
    expect(start.toISOString()).toBe("2026-04-20T00:00:00.000Z");
    expect(end.toISOString()).toBe("2026-04-27T00:00:00.000Z");
  });

  it("anchors on Sunday when configured", () => {
    const { start, end } = currentWeekBounds(friday, 0);
    expect(start.toISOString()).toBe("2026-04-19T00:00:00.000Z");
    expect(end.toISOString()).toBe("2026-04-26T00:00:00.000Z");
  });

  it("returns the anchor day itself as the start", () => {
    const monday = new Date("2026-04-20T14:00:00.000Z");
    const { start } = currentWeekBounds(monday);
    expect(start.toISOString()).toBe("2026-04-20T00:00:00.000Z");
  });

  it("rolls back a full week when called on the day before the anchor", () => {
    // Sunday before a Mon-anchored week → start is the previous Monday.
    const sunday = new Date("2026-04-19T14:00:00.000Z");
    const { start } = currentWeekBounds(sunday);
    expect(start.toISOString()).toBe("2026-04-13T00:00:00.000Z");
  });

  it("spans exactly seven days", () => {
    const { start, end } = currentWeekBounds(friday);
    expect(end.getTime() - start.getTime()).toBe(7 * 24 * 60 * 60 * 1000);
  });
});

/**
 * Insert a check-in directly (skipping `processCommand`) so the retention
 * tests can populate stale timestamps that the user-facing CreateCheckIn
 * validator now rejects. The retention path is independent of how the
 * row got there — it only cares about `timestamp`.
 */
const insertOldCheckIn = async (
  db: ReturnType<typeof getDb>,
  habitId: number,
  timestamp: Date,
) => db.insert(schema.checkIn).values({ habitId, timestamp });

const seedOutbox = async (
  db: ReturnType<typeof getDb>,
  status: "pending" | "sent" | "failed",
) =>
  db.insert(schema.outbox).values({
    commandType: "CreateCheckIn",
    payload: JSON.stringify({}),
    status,
    ...(status === "sent"
      ? { sentAt: new Date(), serverSequence: 1 }
      : status === "failed"
        ? { lastError: "test" }
        : {}),
  });

describe("pruneOldCheckIns", () => {
  it("deletes check-ins older than the cutoff and keeps newer ones", async () => {
    const db = getDb();
    const { habitId } = await processCommand(db, {
      type: "CreateHabit",
      title: "Read",
    });

    await insertOldCheckIn(db, habitId, new Date("2026-01-15T08:00:00.000Z"));
    await insertOldCheckIn(db, habitId, new Date("2026-02-15T08:00:00.000Z"));
    await insertOldCheckIn(db, habitId, new Date("2026-03-15T08:00:00.000Z"));
    await insertOldCheckIn(db, habitId, new Date("2026-04-15T08:00:00.000Z"));

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
    await insertOldCheckIn(db, habitId, new Date("2026-04-01T08:00:00.000Z"));

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
    await insertOldCheckIn(db, habitId, new Date("2026-01-15T08:00:00.000Z"));
    await insertOldCheckIn(db, habitId, new Date("2026-04-15T08:00:00.000Z"));

    // The CreateHabit dispatched above already populated the outbox; mark
    // it sent so the safety gate (no pending/failed rows) is satisfied.
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
    await insertOldCheckIn(db, habitId, new Date("2026-01-15T08:00:00.000Z"));
    await seedOutbox(db, "pending");

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
    await insertOldCheckIn(db, habitId, new Date("2026-01-15T08:00:00.000Z"));
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
