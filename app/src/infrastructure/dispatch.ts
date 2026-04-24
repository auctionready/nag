import { processCommand, type Command, type CommandResult } from "@nag/core";
import { db } from "../db";
import { postCommitBus } from "./postCommitBus";

/**
 * App-level wrapper around `processCommand` that fires the post-commit bus
 * so the outbox dispatcher picks up the new row. All app call sites should
 * go through this instead of importing `processCommand` directly.
 *
 * If the command fails (validation or handler error) the bus is NOT fired —
 * the transaction rolled back and nothing was audited.
 */
export const dispatch = async <T extends Command>(
  command: T,
): Promise<CommandResult<T>> => {
  const result = await processCommand(db, command);
  postCommitBus.emit();
  return result;
};
