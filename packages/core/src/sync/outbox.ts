import { sql, eq, asc } from "drizzle-orm";
import { auditLog, syncState } from "@nag/schema";
import type { AnyDb } from "../db";

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
      id: auditLog.id,
      envelopeId: auditLog.envelopeId,
      commandType: auditLog.commandType,
      payload: auditLog.payload,
      timestamp: auditLog.timestamp,
    })
    .from(auditLog)
    .where(eq(auditLog.status, "pending"))
    .orderBy(asc(auditLog.id))
    .limit(limit);

export const markSent = async (
  db: AnyDb,
  id: number,
  serverSequence: number,
): Promise<void> => {
  await db
    .update(auditLog)
    .set({
      status: "sent",
      sentAt: new Date(),
      serverSequence,
      lastError: null,
    })
    .where(eq(auditLog.id, id));
};

export const markPendingWithError = async (
  db: AnyDb,
  id: number,
  error: string,
): Promise<void> => {
  await db
    .update(auditLog)
    .set({ lastError: error })
    .where(eq(auditLog.id, id));
};

/**
 * Marks the row as `failed` and sets `sync_state.halted = 1` atomically via
 * raw `BEGIN`/`COMMIT` (drizzle's expo-sqlite `transaction()` helper is
 * sync-only; see `processor.ts`).
 */
export const markFailedAndHalt = async (
  db: AnyDb,
  id: number,
  error: string,
): Promise<void> => {
  await db.run(sql`BEGIN`);
  try {
    await db
      .update(auditLog)
      .set({ status: "failed", lastError: error })
      .where(eq(auditLog.id, id));
    await db.update(syncState).set({ halted: true }).where(eq(syncState.id, 1));
    await db.run(sql`COMMIT`);
  } catch (e) {
    await db.run(sql`ROLLBACK`);
    throw e;
  }
};

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
export const resumeDispatch = async (db: AnyDb): Promise<void> => {
  await db.run(sql`BEGIN`);
  try {
    await db
      .update(syncState)
      .set({ halted: false })
      .where(eq(syncState.id, 1));
    await db
      .update(auditLog)
      .set({ status: "pending", lastError: null })
      .where(eq(auditLog.status, "failed"));
    await db.run(sql`COMMIT`);
  } catch (e) {
    await db.run(sql`ROLLBACK`);
    throw e;
  }
};

export const countPending = async (db: AnyDb): Promise<number> => {
  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(auditLog)
    .where(eq(auditLog.status, "pending"));
  return Number(row?.count ?? 0);
};

export const countFailed = async (db: AnyDb): Promise<number> => {
  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(auditLog)
    .where(eq(auditLog.status, "failed"));
  return Number(row?.count ?? 0);
};
