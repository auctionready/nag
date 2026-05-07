import { processCommand, type Command } from "@nag/core";
import { db } from "../db";
import { postCommitBus } from "./postCommitBus";
import { log } from "./log";

const logger = log("dispatch");

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
): Promise<void> => {
  logger.debug(`start ${command.type}`, command);
  try {
    await processCommand(db, command);
    logger.debug(`committed ${command.type}`);
    postCommitBus.emit();
  } catch (error) {
    logger.error(`failed ${command.type}`, error);
    throw error;
  }
};
