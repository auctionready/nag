import { sql } from "drizzle-orm";
import type { AnyDb } from "../db";
import { Command } from "./schemas";
import type { HandlerMap } from "./handlers";
import { handlers } from "./handlers";
import { audit, type HandlerAuditContext } from "./auditor";

export type CommandResult<T extends Command> = Awaited<
  ReturnType<HandlerMap[T["type"]]>
>;

/**
 * Executes a command transactionally: BEGIN → handler → audit → COMMIT.
 *
 * Uses raw `BEGIN` / `COMMIT` (not `db.transaction`) because drizzle-orm's
 * expo-sqlite driver ships a synchronous `transaction()` helper whose
 * callback signature is `(tx) => T`. Passing an async callback commits
 * before the awaited inserts resolve; the raw pattern is the correct
 * workaround on RN until drizzle exposes an async variant.
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

  await db.run(sql`BEGIN`);
  try {
    const result = await handler(db, command);
    await audit(db, command, (result ?? {}) as HandlerAuditContext);
    await db.run(sql`COMMIT`);
    return result;
  } catch (error) {
    await db.run(sql`ROLLBACK`);
    throw error;
  }
}
