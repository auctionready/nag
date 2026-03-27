import { checkIn } from "@nag/schema";
import type { AnyDb } from "../../db";
import type { CreateCheckIn } from "../schemas";

export async function handleCreateCheckIn(
  db: AnyDb,
  command: CreateCheckIn,
): Promise<{ checkInId: number }> {
  const [inserted] = await db
    .insert(checkIn)
    .values({ habitId: command.habitId, skipped: command.skipped ?? false })
    .returning({ id: checkIn.id });

  return { checkInId: inserted.id };
}
