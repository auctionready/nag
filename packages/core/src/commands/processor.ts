import { sql } from "drizzle-orm";
import type { AnyDb } from "../db";
import { Command } from "./schemas";
import { handlers } from "./handlers";
import { audit } from "./auditor";

export type CommandResult = Awaited<ReturnType<(typeof handlers)[Command["type"]]>>;

export async function processCommand(
  db: AnyDb,
  input: unknown,
): Promise<CommandResult> {
  const command = Command.parse(input);
  const handler = handlers[command.type];

  await db.run(sql`BEGIN`);
  try {
    const result = await handler(db, command);
    await audit(db, command);
    await db.run(sql`COMMIT`);
    return result;
  } catch (error) {
    await db.run(sql`ROLLBACK`);
    throw error;
  }
}
