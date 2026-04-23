import { sql } from "drizzle-orm";
import type { AnyDb } from "../db";
import { Command } from "./schemas";
import type { HandlerMap } from "./handlers";
import { handlers } from "./handlers";
import { audit } from "./auditor";

export type CommandResult<T extends Command> = Awaited<
  ReturnType<HandlerMap[T["type"]]>
>;

let afterCommitHook: (() => void) | undefined;

export const setAfterCommitHook = (hook: (() => void) | undefined) => {
  afterCommitHook = hook;
};

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
    await audit(db, command);
    await db.run(sql`COMMIT`);
    afterCommitHook?.();
    return result;
  } catch (error) {
    await db.run(sql`ROLLBACK`);
    throw error;
  }
}
