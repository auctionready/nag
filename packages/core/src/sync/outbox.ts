import { sql, eq, asc } from "drizzle-orm";
import { outbox, syncState } from "@nag/schema";
import type { AnyDb } from "../db";
import { withTransaction } from "../db/transaction";

export type PendingRow = {
  id: number;
  envelopeId: string;
  commandType: string;
  payload: string | null;
  timestamp: Date;
};

export const loadPendingBatch = (
  db: AnyDb,
  limit: number,
): Promise<PendingRow[]> =>
  db
    .select({
      id: outbox.id,
      envelopeId: outbox.envelopeId,
      commandType: outbox.commandType,
      payload: outbox.payload,
      timestamp: outbox.timestamp,
    })
    .from(outbox)
    .where(eq(outbox.status, "pending"))
    .orderBy(asc(outbox.id))
    .limit(limit);

/**
 * Marks the outbox row sent and bumps `sync_state.highest_server_sequence`
 * so the next pull-sync `since` value reflects the just-acknowledged write.
 * Both updates run in one transaction so a crash between them either sees
 * both or neither — preventing the high-water mark from advancing past a
 * row that's still pending.
 */
export const markSent = async (
  db: AnyDb,
  id: number,
  serverSequence: number,
): Promise<void> =>
  withTransaction(db, async () => {
    await db
      .update(outbox)
      .set({
        status: "sent",
        sentAt: new Date(),
        serverSequence,
        lastError: null,
      })
      .where(eq(outbox.id, id));
    await db
      .update(syncState)
      .set({
        highestServerSequence: sql`MAX(${syncState.highestServerSequence}, ${serverSequence})`,
      })
      .where(eq(syncState.id, 1));
  });

export const markPendingWithError = async (
  db: AnyDb,
  id: number,
  error: string,
): Promise<void> => {
  await db.update(outbox).set({ lastError: error }).where(eq(outbox.id, id));
};

/** Marks the row as `failed` and sets `sync_state.halted = 1` atomically. */
export const markFailedAndHalt = async (
  db: AnyDb,
  id: number,
  error: string,
): Promise<void> =>
  withTransaction(db, async () => {
    await db
      .update(outbox)
      .set({ status: "failed", lastError: error })
      .where(eq(outbox.id, id));
    await db.update(syncState).set({ halted: true }).where(eq(syncState.id, 1));
  });

export const isHalted = async (db: AnyDb): Promise<boolean> => {
  const [row] = await db
    .select({ halted: syncState.halted })
    .from(syncState)
    .where(eq(syncState.id, 1));
  return row?.halted === true;
};

/**
 * Clears the halted flag AND transitions every `failed` row back to
 * `pending` in one transaction. Envelope IDs are preserved so retries remain
 * idempotent on the server. Called by the app's "Resume sync" admin action.
 */
export const resumeDispatch = async (db: AnyDb): Promise<void> =>
  withTransaction(db, async () => {
    await db
      .update(syncState)
      .set({ halted: false })
      .where(eq(syncState.id, 1));
    await db
      .update(outbox)
      .set({ status: "pending", lastError: null })
      .where(eq(outbox.status, "failed"));
  });

export const countPending = async (db: AnyDb): Promise<number> => {
  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(outbox)
    .where(eq(outbox.status, "pending"));
  return Number(row?.count ?? 0);
};

export const countFailed = async (db: AnyDb): Promise<number> => {
  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(outbox)
    .where(eq(outbox.status, "failed"));
  return Number(row?.count ?? 0);
};

export const getHighestServerSequence = async (db: AnyDb): Promise<number> => {
  const [row] = await db
    .select({ value: syncState.highestServerSequence })
    .from(syncState)
    .where(eq(syncState.id, 1));
  return Number(row?.value ?? 0);
};
