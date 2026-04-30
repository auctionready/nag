import { sql, eq, asc } from "drizzle-orm";
import { outbox, syncState } from "@nag/schema";
import type { AnyDb } from "../db";
import { withTransaction } from "../db/transaction";

export type PendingRow = {
  id: number;
  envelopeId: string;
  events: string;
  timestamp: Date;
};

/**
 * Default retention for sent outbox rows after each successful send. The
 * value is read from the `NAG_SENT_OUTBOX_RETAIN` env var at module load
 * (so tests can override it via Vitest's env config); set to `-1` to
 * disable pruning entirely and keep every sent row. Falls back to 10 when
 * the env var is unset, empty, or unparseable.
 *
 * Retained rows are useful only for debugging — `serverSequence` is
 * mirrored into `sync_state.highest_server_sequence`, and pending replays
 * use envelope IDs.
 */
export const SENT_OUTBOX_RETAIN_DEFAULT: number = readRetainEnv();

function readRetainEnv(): number {
  const raw =
    typeof process !== "undefined"
      ? process.env?.NAG_SENT_OUTBOX_RETAIN
      : undefined;
  if (raw === undefined || raw === "") return 10;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return 10;
  return Math.trunc(parsed);
}

export const loadPendingBatch = (
  db: AnyDb,
  limit: number,
): Promise<PendingRow[]> =>
  db
    .select({
      id: outbox.id,
      envelopeId: outbox.envelopeId,
      events: outbox.events,
      timestamp: outbox.timestamp,
    })
    .from(outbox)
    .where(eq(outbox.status, "pending"))
    .orderBy(asc(outbox.id))
    .limit(limit);

/**
 * Marks the outbox row sent, bumps `sync_state.highest_server_sequence`
 * so the next pull-sync `since` value reflects the just-acknowledged write,
 * and prunes older sent rows so the outbox can't grow unbounded. All three
 * updates run in one transaction so a crash between them either sees all
 * or none — preventing the high-water mark from advancing past a row
 * that's still pending, and keeping the prune transactional with the
 * write that triggered it.
 *
 * `retainSentRows` keeps the most recent N sent rows (newest by id) for
 * debugging visibility; everything older is dropped. A negative value
 * (e.g. `-1`) disables pruning entirely so every sent row is retained —
 * useful when `NAG_SENT_OUTBOX_RETAIN=-1` is set during investigation.
 */
export const markSent = async (
  db: AnyDb,
  id: number,
  serverSequence: number,
  retainSentRows: number = SENT_OUTBOX_RETAIN_DEFAULT,
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
    if (retainSentRows >= 0) {
      // Drop sent rows older than the most recent `retainSentRows`. The
      // subquery form keeps the newest N regardless of how many sends
      // happened since the last prune.
      await db.run(sql`
        DELETE FROM outbox
        WHERE status = 'sent'
          AND id NOT IN (
            SELECT id FROM outbox
            WHERE status = 'sent'
            ORDER BY id DESC
            LIMIT ${retainSentRows}
          )
      `);
    }
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

export const countSent = async (db: AnyDb): Promise<number> => {
  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(outbox)
    .where(eq(outbox.status, "sent"));
  return Number(row?.count ?? 0);
};

export const getHighestServerSequence = async (db: AnyDb): Promise<number> => {
  const [row] = await db
    .select({ value: syncState.highestServerSequence })
    .from(syncState)
    .where(eq(syncState.id, 1));
  return Number(row?.value ?? 0);
};
