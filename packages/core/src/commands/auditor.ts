import { auditLog } from "@nag/schema";
import type { AnyDb } from "../db";
import type { Command } from "./schemas";

export async function audit(db: AnyDb, command: Command): Promise<void> {
  const { type, ...rest } = command;
  const hasPayload = Object.keys(rest).length > 0;
  await db.insert(auditLog).values({
    commandType: type,
    payload: hasPayload ? JSON.stringify(rest) : null,
  });
}
