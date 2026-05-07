import type { AnyDb } from "../db";
import { withTransaction } from "../db/transaction";
import { applyEvent } from "../events/handlers";
import { Command } from "./schemas";
import type { HandlerMap } from "./handlers";
import { handlers } from "./handlers";
import { enqueueEvents } from "./enqueueOutbox";
import { syncAllNotifications } from "../notificationConsolidator";

export type CommandResult<T extends Command> = ReturnType<
  Awaited<ReturnType<HandlerMap[T["type"]]>>["finalize"]
>;

/**
 * Executes a command transactionally: BEGIN → handler → apply events →
 * enqueue → COMMIT, then refreshes the OS notification schedule outside
 * the transaction.
 *
 * Command handlers are pure event producers — they read whatever state
 * they need to validate the intent and emit one or more past-tense
 * events, but never write to the DB themselves. The processor then
 * dispatches each event through the type-keyed event registry
 * (`applyEvent`) — the same registry server-replay uses — so the
 * per-event-type DB logic has exactly one home, shared between the
 * command path and `/sync` replay. The handler's `finalize` callback
 * stitches the apply results (assigned local ids, schedule ids, etc.)
 * into the caller-facing CommandResult shape.
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
): Promise<CommandResult<T>> {
  const command = Command.parse(input) as T;
  const handler = handlers[command.type] as unknown as (
    db: AnyDb,
    command: T,
  ) => Promise<{
    events: { type: string }[];
    finalize: (applied: unknown[]) => CommandResult<T>;
  }>;

  const result = await withTransaction<CommandResult<T>>(db, async () => {
    const { events, finalize } = await handler(db, command);
    const applied: unknown[] = [];
    for (const event of events) {
      const { type, ...payload } = event;
      applied.push(await applyEvent(db, type, payload));
    }
    await enqueueEvents(db, { events: events as never });
    return finalize(applied);
  });

  await syncAllNotifications(db);
  return result;
}
