import type { AnyDb } from "../db";
import { getAccountId } from "../identity";
import {
  loadPendingBatch,
  markSent,
  markPendingWithError,
  markFailedAndHalt,
  isHalted,
} from "./outbox";
import { applyServerEvent } from "./applyServerEvent";
import type {
  EventEntry,
  DispatchStatus,
  PostEventsFn,
  WriteEventEnvelope,
} from "./types";

export type DispatcherOptions = {
  db: AnyDb;
  post: PostEventsFn;
  batchSize?: number;
  /**
   * Hard cap on how many batches a single `run()` will process before
   * yielding back. Prevents a runaway drain loop in the (theoretical)
   * case where `markSent` silently no-ops a row — the next
   * `loadPendingBatch` would otherwise return the same row forever.
   * Default 50 batches × default 20 batch size = 1000 rows per run;
   * any remainder is left for the next trigger.
   */
  maxBatchesPerRun?: number;
  /**
   * Optional hook for side-effects on halt / transient errors (e.g. Sentry
   * capture). Not called on happy-path success.
   */
  onError?: (error: unknown) => void;
  /**
   * Optional structured log sink. The app injects a tag-prefixed logger so
   * dispatcher internals (batch size, per-row transitions, markSent success)
   * appear in the same stream as the rest of the sync pipeline.
   */
  log?: {
    debug?: (msg: string, ...args: unknown[]) => void;
    info?: (msg: string, ...args: unknown[]) => void;
    error?: (msg: string, ...args: unknown[]) => void;
  };
};

export type Dispatcher = {
  /**
   * Drains the outbox: repeatedly loads up to `batchSize` pending rows,
   * POSTs each serially, and transitions the row based on the response.
   * Loops until the queue is empty or a failure interrupts. Returns a
   * terminal status:
   *   - `idle`    — every pending row was sent (or the queue was empty)
   *   - `halted`  — a 4xx (or local parse failure) was encountered;
   *                 `halt` flag set; stop
   *   - `offline` — a transient error (network / 5xx) was encountered;
   *                 the row remains pending and any further batches are
   *                 left for the next run
   */
  run: () => Promise<DispatchStatus>;
};

export const createDispatcher = ({
  db,
  post,
  batchSize = 20,
  maxBatchesPerRun = 50,
  onError,
  log,
}: DispatcherOptions): Dispatcher => {
  const debug = log?.debug ?? (() => {});
  const error = log?.error ?? (() => {});

  const run = async (): Promise<DispatchStatus> => {
    if (await isHalted(db)) {
      debug("dispatcher.run: halted — skipping");
      return "halted";
    }

    const accountId = await getAccountId(db);
    if (!accountId) {
      debug(
        "dispatcher.run: no accountId — device not registered, treating as offline",
      );
      return "offline";
    }

    // Drain everything that's pending. After processing a full batch we
    // loop and reload — otherwise a backlog larger than `batchSize` would
    // need a separate trigger (post-commit, safety timer) per batch to
    // fully flush, leaving the user staring at a non-zero pending count
    // for longer than necessary. New rows queued mid-run are picked up
    // by the next loadPendingBatch call.
    let batches = 0;
    while (batches < maxBatchesPerRun) {
      const rows = await loadPendingBatch(db, batchSize);
      debug(
        `dispatcher.run: loaded ${rows.length} pending row(s) (batch ${batches + 1})`,
      );
      if (rows.length === 0) {
        if (batches === 0) {
          // No work this run.
          return "idle";
        }
        debug(`dispatcher.run: drained — ${batches} batch(es) processed`);
        return "idle";
      }
      batches++;

      for (const row of rows) {
        let events: EventEntry[];
        try {
          events = JSON.parse(row.events) as EventEntry[];
        } catch (parseErr) {
          const message =
            parseErr instanceof Error ? parseErr.message : String(parseErr);
          error(
            `dispatcher: row id=${row.id} events JSON parse failed: ${message}`,
          );
          await markFailedAndHalt(db, row.id, `events JSON parse: ${message}`);
          onError?.(parseErr);
          return "halted";
        }
        const envelope: WriteEventEnvelope = {
          id: row.envelopeId,
          timestamp: row.timestamp.toISOString(),
          events,
        };
        const types = events.map((e) => e.type).join(",");
        debug(
          `dispatcher: POSTing row id=${row.id} envelope=${envelope.id} types=[${types}]`,
        );

        let result;
        try {
          result = await post(envelope);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          error(
            `dispatcher: post threw for row id=${row.id} envelope=${envelope.id}: ${message}`,
          );
          await markPendingWithError(db, row.id, message);
          onError?.(err);
          return "offline";
        }

        if (result.ok) {
          debug(
            `dispatcher: row id=${row.id} accepted sequence=${result.sequence} — marking sent`,
          );
          try {
            await markSent(db, row.id, result.sequence);
            debug(`dispatcher: row id=${row.id} marked sent`);
          } catch (err) {
            error(`dispatcher: markSent threw for row id=${row.id}`, err);
            onError?.(err);
            throw err;
          }

          // Reconcile: apply the server's authoritative version of each
          // event to local state. In the happy path these are byte-identical
          // to the optimistic events the handler already applied — every
          // applyServerEvent handler is keyed on externalId via upserts, so
          // re-applying them is a no-op. On the rare divergence (server
          // normalised something) the upsert overwrites local state with
          // the server's version. Best-effort: a failure here doesn't
          // halt the batch — the local DB still has the optimistic state
          // and the next /sync pass would only re-fetch events past the
          // already-advanced high-water mark, so we capture and move on
          // rather than wedge sync over a transient apply error.
          for (const event of result.events) {
            try {
              await applyServerEvent(db, {
                sequence: event.sequence,
                id: event.id,
                type: event.type,
                timestamp: event.timestamp,
                payload: event.payload,
              });
            } catch (err) {
              error(
                `dispatcher: reconcile failed for row id=${row.id} event seq=${event.sequence} type=${event.type}`,
                err,
              );
              onError?.(err);
            }
          }
          continue;
        }

        if (result.kind === "non-retriable") {
          const detail = `${result.status}: ${result.message}`;
          error(
            `dispatcher: row id=${row.id} non-retriable — halting (${detail})`,
          );
          await markFailedAndHalt(db, row.id, detail);
          onError?.(new Error(`non-retriable ${detail}`));
          return "halted";
        }

        // transient
        debug(
          `dispatcher: row id=${row.id} transient (${result.message}) — stopping`,
        );
        await markPendingWithError(db, row.id, result.message);
        return "offline";
      }
      // Batch fully drained — loop to load the next.
    }
    // Hit the per-run cap. Some rows may still be pending; the next
    // trigger (post-commit, safety timer) will resume.
    debug(
      `dispatcher.run: hit maxBatchesPerRun=${maxBatchesPerRun} — yielding`,
    );
    return "idle";
  };

  return { run };
};
