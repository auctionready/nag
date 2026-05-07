import { eq } from "drizzle-orm";
import { checkIn, habit } from "@nag/schema";
import type { AnyDb } from "../../db";

export type CheckInRecordedPayload = {
  checkInId: string;
  habitId: string;
  timestamp: string;
  skipped?: boolean | null;
};

export const applyCheckInRecorded = async (
  db: AnyDb,
  payload: CheckInRecordedPayload,
): Promise<void> => {
  // Sync replays can arrive out of order — a CheckInRecorded for a habit
  // we don't have locally (e.g. an old event whose HabitCreated was pruned
  // server-side or hasn't replayed yet) is dropped rather than crashing on
  // the FK. Same shape as the pre-UUID-PK behaviour: the row only lands if
  // its parent exists.
  const [parent] = await db
    .select({ id: habit.id })
    .from(habit)
    .where(eq(habit.id, payload.habitId));
  if (!parent) return;

  await db
    .insert(checkIn)
    .values({
      id: payload.checkInId,
      habitId: payload.habitId,
      timestamp: new Date(payload.timestamp),
      skipped: payload.skipped ?? false,
    })
    .onConflictDoUpdate({
      target: checkIn.id,
      set: {
        habitId: payload.habitId,
        timestamp: new Date(payload.timestamp),
        skipped: payload.skipped ?? false,
        updatedAt: new Date(),
      },
    });
};
