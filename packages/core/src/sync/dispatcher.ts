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
   * Load the next batch of pending rows, POST them serially, and transition
   * each row based on the response. Returns a terminal status:
   *   - `idle`    — batch empty (or finished without error)
   *   - `halted`  — 4xx encountered; `halt` flag set; stop
   *   - `offline` — transient error (network / 5xx); row remains pending
   */
  run: () => Promise<DispatchStatus>;
};

export const createDispatcher = ({
  db,
  post,
  batchSize = 20,
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

    const rows = await loadPendingBatch(db, batchSize);
    debug(`dispatcher.run: loaded ${rows.length} pending row(s)`);
    if (rows.length === 0) return "idle";

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
        `dispatcher: row id=${row.id} transient (${result.message}) — stopping batch`,
      );
      await markPendingWithError(db, row.id, result.message);
      return "offline";
    }

    debug("dispatcher.run: batch complete — idle");
    return "idle";
  };

  return { run };
};
