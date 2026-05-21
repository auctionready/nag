import { sql, eq, asc } from "drizzle-orm";
import { outbox, syncState } from "@nag/schema";
import type { AnyDb } from "../db";
import { withTransaction } from "../db/transaction";

export type PendingRow = {
  id: string;
  events: string;
  createdAt: Date;
};

/**
 * Default retention for sent outbox rows after each successful send. The
 * value is read from the `NAG_SENT_OUTBOX_RETAIN` env var at module load
 * (so tests can override it via Vitest's env config). Pruning is disabled
 * by default (`-1` — every sent row is kept); set the env var to a
 * non-negative integer to re-enable, or `0` to drop every sent row.
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
  if (raw === undefined || raw === "") return -1;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return -1;
  return Math.trunc(parsed);
}

export const loadPendingBatch = (
  db: AnyDb,
  limit: number,
): Promise<PendingRow[]> =>
  db
    .select({
      id: outbox.id,
      events: outbox.events,
      createdAt: outbox.createdAt,
    })
    .from(outbox)
    .where(eq(outbox.status, "pending"))
    .orderBy(asc(outbox.id))
    .limit(limit);

/**
 * Marks the outbox row sent and prunes older sent rows so the outbox
 * can't grow unbounded. Both updates run in one transaction so a crash
 * between them either sees all or none — keeping the prune transactional
 * with the write that triggered it.
 *
 * Deliberately does NOT advance `sync_state.highest_server_sequence`.
 * The server assigns this envelope a sequence at the head of its log,
 * but it may also have appended events from other devices at sequences
 * between our previous high-water mark and the one we just received.
 * Optimistically bumping past those would cause the next
 * `GET /sync?since=N` to skip them — a permanent gap, since nothing
 * else triggers a re-pull from an earlier point. Instead we let the
 * pull-sync that runs immediately after the push advance the mark by
 * re-fetching from the unchanged high-water mark; the response will
 * include both our just-pushed event (idempotent upsert) and any
 * interleaved events from other devices.
 *
 * `retainSentRows` keeps the most recent N sent rows (newest by id) for
 * debugging visibility; everything older is dropped. A negative value
 * (e.g. `-1`) disables pruning entirely so every sent row is retained —
 * useful when `NAG_SENT_OUTBOX_RETAIN=-1` is set during investigation.
 */
export const markSent = async (
  db: AnyDb,
  id: string,
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
  id: string,
  error: string,
): Promise<void> => {
  await db.update(outbox).set({ lastError: error }).where(eq(outbox.id, id));
};

/** Marks the row as `failed` and sets `sync_state.halted = 1` atomically. */
export const markFailedAndHalt = async (
  db: AnyDb,
  id: string,
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

export const isPaused = async (db: AnyDb): Promise<boolean> => {
  const [row] = await db
    .select({ paused: syncState.paused })
    .from(syncState)
    .where(eq(syncState.id, 1));
  return row?.paused === true;
};

/**
 * Clears the halt flag without touching outbox rows. Called automatically
 * after a successful device (re-)registration: a working credential is
 * proof that whatever 4xx originally tripped the halt is no longer in
 * effect, so the dispatcher should be allowed to retry on its next tick.
 * Distinct from `resumeDispatch`, which also flips `failed` rows back to
 * `pending` (the manual admin recovery for rows the server permanently
 * rejected).
 */
export const clearHalted = async (db: AnyDb): Promise<void> => {
  await db.update(syncState).set({ halted: false }).where(eq(syncState.id, 1));
};

/**
 * Sets `sync_state.paused = true`, which causes the outbox dispatcher
 * and pull-sync to short-circuit on their next tick. Distinct from
 * `halted` (which carries an error story); pause is a deliberate
 * user-initiated stop with no error, undone only by an explicit
 * `resumeDispatch`. The Clerk session stays live so the device
 * remains owned by the signed-in user — the dispatcher just refuses
 * to ship.
 */
export const pauseDispatch = async (db: AnyDb): Promise<void> => {
  await db.update(syncState).set({ paused: true }).where(eq(syncState.id, 1));
};

/**
 * Clears BOTH `halted` and `paused` AND transitions every `failed` row
 * back to `pending` in one transaction. Envelope IDs are preserved so
 * retries remain idempotent on the server. Called by the user's
 * "Resume sync" action — covers both the "halted on a 4xx" recovery
 * path and the "I paused this on purpose, let it go again" path with
 * the same single button.
 */
export const resumeDispatch = async (db: AnyDb): Promise<void> =>
  withTransaction(db, async () => {
    await db
      .update(syncState)
      .set({ halted: false, paused: false })
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
