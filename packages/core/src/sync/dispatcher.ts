import type { AnyDb } from "../db";
import {
  loadPendingBatch,
  markSent,
  markPendingWithError,
  markFailedAndHalt,
  isHalted,
} from "./outbox";
import type { CommandEnvelope, DispatchStatus, PostCommandsFn } from "./types";

export type DispatcherOptions = {
  db: AnyDb;
  post: PostCommandsFn;
  batchSize?: number;
  /**
   * Optional hook for side-effects on halt / transient errors (e.g. Sentry
   * capture). Not called on happy-path success.
   */
  onError?: (error: unknown) => void;
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
}: DispatcherOptions): Dispatcher => {
  const run = async (): Promise<DispatchStatus> => {
    if (await isHalted(db)) return "halted";

    const rows = await loadPendingBatch(db, batchSize);
    if (rows.length === 0) return "idle";

    for (const row of rows) {
      const envelope: CommandEnvelope = {
        id: row.envelopeId,
        timestamp: row.timestamp.toISOString(),
        type: row.commandType,
        payload: row.payload ? JSON.parse(row.payload) : {},
      };

      let result;
      try {
        result = await post(envelope);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await markPendingWithError(db, row.id, message);
        onError?.(error);
        return "offline";
      }

      if (result.ok) {
        await markSent(db, row.id, result.sequence);
        continue;
      }

      if (result.kind === "non-retriable") {
        const detail = `${result.status}: ${result.message}`;
        await markFailedAndHalt(db, row.id, detail);
        onError?.(new Error(`non-retriable ${detail}`));
        return "halted";
      }

      // transient
      await markPendingWithError(db, row.id, result.message);
      return "offline";
    }

    return "idle";
  };

  return { run };
};
