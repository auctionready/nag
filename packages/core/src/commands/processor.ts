import type { AnyDb } from "../db";
import { withTransaction } from "../db/transaction";
import { Command } from "./schemas";
import type { HandlerMap } from "./handlers";
import { handlers } from "./handlers";
import { audit, type HandlerEventsContext } from "./auditor";
import { syncAllNotifications } from "../notificationConsolidator";

export type CommandResult<T extends Command> = Awaited<
  ReturnType<HandlerMap[T["type"]]>
>;

/**
 * Executes a command transactionally: BEGIN → handler → audit → COMMIT,
 * then refreshes the OS notification schedule outside the transaction.
 *
 * The handler returns both the local-DB outcome (ids assigned by SQLite,
 * etc.) and the past-tense `events` the intent produced. The auditor
 * writes those events as a single outbox envelope row so the dispatcher
 * can ship them to `POST /events` verbatim — keeping client and server
 * on the same event vocabulary.
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
): Promise<Awaited<ReturnType<HandlerMap[T["type"]]>>> {
  const command = Command.parse(input) as T;
  const handler = handlers[command.type] as unknown as (
    db: AnyDb,
    command: T,
  ) => ReturnType<HandlerMap[T["type"]]>;

  type R = Awaited<ReturnType<HandlerMap[T["type"]]>>;
  const result = await withTransaction<R>(db, async (): Promise<R> => {
    const r = (await handler(db, command)) as R;
    await audit(db, r as unknown as HandlerEventsContext);
    return r;
  });

  await syncAllNotifications(db);
  return result;
}
