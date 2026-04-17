import { sql } from "drizzle-orm";
import type { AnyDb } from "../db";
import { Command } from "./schemas";
import type { HandlerMap } from "./handlers";
import { handlers } from "./handlers";
import { audit } from "./auditor";

export type CommandResult<T extends Command> = Awaited<
  ReturnType<HandlerMap[T["type"]]>
>;

export type PostCommandInterceptor = (
  db: AnyDb,
  command: Command,
) => Promise<void> | void;

let postCommand: PostCommandInterceptor | undefined;

/**
 * Register an interceptor invoked after every successfully-committed
 * command. Receives the parsed command so it can decide which ones to
 * react to. Pass `undefined` to clear. Runs outside the command's
 * transaction, so its errors propagate but don't roll back the commit.
 */
export const setPostCommandInterceptor = (
  fn: PostCommandInterceptor | undefined,
): void => {
  postCommand = fn;
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
  let result: Awaited<ReturnType<HandlerMap[T["type"]]>>;
  try {
    result = await handler(db, command);
    await audit(db, command);
    await db.run(sql`COMMIT`);
  } catch (error) {
    await db.run(sql`ROLLBACK`);
    throw error;
  }
  if (postCommand) await postCommand(db, command);
  return result;
}
