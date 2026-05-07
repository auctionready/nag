import type { AnyDb } from "../db";
import { withTransaction } from "../db/transaction";
import { applyEvent } from "../events/handlers";
import { Command } from "./schemas";
import { handlers } from "./handlers";
import { enqueueEvents } from "./enqueueOutbox";
import { syncAllNotifications } from "../notificationConsolidator";

/**
 * Executes a command transactionally: BEGIN → handler → apply events →
 * enqueue → COMMIT, then refreshes the OS notification schedule outside
 * the transaction.
 *
 * Command handlers are pure event producers — they may read DB state to
 * validate the intent or fill in wire fields (e.g. `UpdateCheckIn`
 * reading the current row to compute the right diff event), but never
 * write. The processor then dispatches each event through the type-keyed
 * event registry (`applyEvent`) — the same registry server-replay uses —
 * so the per-event-type DB logic has exactly one home, shared between
 * the command path and `/sync` replay.
 *
 * Identities (habit ids, check-in ids, envelope ids) are minted by the
 * caller — for entity ids, in the command itself; for the envelope id,
 * by the schema's `outbox.id` `$defaultFn`. Nothing in this function
 * generates a new identity, so there's no result to return.
 *
 * Notification sync runs post-commit because the expo-notifications API
 * calls (cancel + reschedule) can take seconds and used to block the
 * BEGIN window — a tap on a board tile didn't animate until they
 * finished. The data write is what matters for atomicity; a stale
 * schedule self-heals on the next mutation or app foreground.
 *
 * Uses `withTransaction` (a JS-side promise-chain mutex over raw
 * `BEGIN`/`COMMIT`) because drizzle-orm's expo-sqlite `db.transaction()`
 * callback is sync-only — passing an async callback commits before
 * awaited writes resolve. The mutex also serializes against other
 * transaction sites (outbox dispatcher, pull-sync) on the single shared
 * connection.
 */
export async function processCommand<T extends Command>(
  db: AnyDb,
  input: T,
): Promise<void> {
  const command = Command.parse(input) as T;
  const handler = handlers[command.type] as unknown as (
    db: AnyDb,
    command: T,
  ) => Promise<{ events: { type: string }[] }>;

  await withTransaction<void>(db, async () => {
    const { events } = await handler(db, command);
    for (const event of events) {
      const { type, ...payload } = event;
      await applyEvent(db, type, payload);
    }
    await enqueueEvents(db, { events: events as never });
  });

  await syncAllNotifications(db);
}
