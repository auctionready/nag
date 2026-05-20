import { sql, eq } from "drizzle-orm";
import { syncState } from "@nag/schema";
import type { AnyDb } from "../db";
import { withTransaction } from "../db/transaction";
import { applyEvent } from "../events/handlers";

/**
 * Server-shipped event envelope as it arrives over `/sync` replay. Loose
 * shape — the type discriminator drives our switch and the payload is
 * narrowed at apply time. `sequence` is required in practice but typed
 * optional to match the upstream Zodios schema.
 */
export type ServerEvent = {
  sequence?: number;
  id?: string;
  timestamp?: string | Date;
  type: string;
  payload: unknown;
};

/**
 * Options for {@link applyServerEvent}.
 *
 * `advanceHighWaterMark` (default `true`): when applying an event we
 * just pulled via `GET /sync` we MAX-merge
 * `sync_state.highest_server_sequence` with the envelope's sequence so
 * the next page request starts from the right place. When applying the
 * server's authoritative echo of an event we just pushed via
 * `POST /events` (the dispatcher's reconcile step) we must NOT advance
 * the high-water mark — the server may have appended other devices'
 * events at sequences between our previous mark and our pushed event's
 * sequence, and bumping past those would skip them permanently. See
 * `outbox.ts#markSent` for the matching rationale.
 */
export type ApplyServerEventOptions = {
  advanceHighWaterMark?: boolean;
};

/**
 * Applies one server-shipped event envelope to the local DB and (by
 * default) advances `sync_state.highest_server_sequence` to the
 * envelope's sequence — all in one transaction so a crash mid-apply
 * rolls back both the data write and the high-water mark bump. The
 * per-type DB logic lives in `events/handlers` and is shared with the
 * command path; here we just dispatch through the registry and
 * (optionally) bump the high-water mark.
 *
 * Does NOT write to `outbox`: these events originated from the server,
 * not from a local user action.
 */
export const applyServerEvent = async (
  db: AnyDb,
  envelope: ServerEvent,
  options: ApplyServerEventOptions = {},
): Promise<void> => {
  const advance = options.advanceHighWaterMark ?? true;
  return withTransaction(db, async () => {
    await applyEvent(db, envelope.type, envelope.payload);

    if (
      advance &&
      envelope.sequence !== undefined &&
      envelope.sequence !== null
    ) {
      const seq = envelope.sequence;
      await db
        .update(syncState)
        .set({
          highestServerSequence: sql`MAX(${syncState.highestServerSequence}, ${seq})`,
        })
        .where(eq(syncState.id, 1));
    }
  });
};
