import { sql, eq } from "drizzle-orm";
import { habit, goal, schedule, checkIn, syncState } from "@nag/schema";
import type { AnyDb } from "../db";
import { withTransaction } from "../db/transaction";

/**
 * Server-shipped event envelope as it arrives over `/sync` replay. Loose
 * shape — the type discriminator drives our switch and the payload is
 * narrowed at apply time. `sequence` is required in practice but typed
 * optional to match the upstream Zodios schema.
 */
export type ServerEvent = {
  sequence?: number;
  id?: string;
  timestamp?: string | Date;
  type: string;
  payload: unknown;
};

/**
 * Server-shaped goal payload (externalId-keyed). Mirrors the C# `GoalPayload`
 * record; the backend echoes it back unchanged on `/sync` replay.
 */
type ServerGoal = {
  regularity: "day" | "week" | "month";
  frequency: number | null;
  schedules:
    | {
        hour: number;
        minute: number;
        days: number | null;
        dayOfMonth: number | null;
        reminder: boolean | null;
      }[]
    | null;
};

const popcount = (n: number): number => {
  let count = 0;
  while (n) {
    count += n & 1;
    n >>= 1;
  }
  return count;
};

const computeFrequency = (g: ServerGoal): number => {
  if (g.schedules && g.schedules.length > 0) {
    if (g.regularity === "week") {
      return g.schedules.reduce((sum, s) => sum + popcount(s.days ?? 0), 0);
    }
    return g.schedules.length;
  }
  return g.frequency ?? 1;
};

const writeGoalAndSchedules = async (
  db: AnyDb,
  habitId: number,
  goalPayload: ServerGoal,
): Promise<void> => {
  await db.delete(goal).where(eq(goal.habitId, habitId));
  const [insertedGoal] = await db
    .insert(goal)
    .values({
      habitId,
      regularity: goalPayload.regularity,
      frequency: computeFrequency(goalPayload),
    })
    .returning({ id: goal.id });

  if (goalPayload.schedules && goalPayload.schedules.length > 0) {
    await db.insert(schedule).values(
      goalPayload.schedules.map((s) => ({
        goalId: insertedGoal.id,
        hour: s.hour,
        minute: s.minute,
        days: s.days,
        dayOfMonth: s.dayOfMonth,
        reminder: s.reminder ?? true,
      })),
    );
  }
};

const lookupHabitId = async (
  db: AnyDb,
  externalId: string,
): Promise<number | null> => {
  const [row] = await db
    .select({ id: habit.id })
    .from(habit)
    .where(eq(habit.externalId, externalId));
  return row?.id ?? null;
};

const applyHabitCreated = async (
  db: AnyDb,
  payload: {
    habitId: string;
    title: string;
    description?: string | null;
    icon?: string | null;
    goal?: ServerGoal | null;
  },
): Promise<void> => {
  // Upsert keyed on external_id so a replay of an already-applied
  // event (e.g. our own command echoed back as an event, or a redelivery
  // on resume) is a no-op rather than a constraint violation.
  await db
    .insert(habit)
    .values({
      externalId: payload.habitId,
      title: payload.title,
      description: payload.description ?? null,
      icon: payload.icon ?? null,
    })
    .onConflictDoUpdate({
      target: habit.externalId,
      set: {
        title: payload.title,
        description: payload.description ?? null,
        icon: payload.icon ?? null,
        updatedAt: new Date(),
      },
    });

  const habitId = await lookupHabitId(db, payload.habitId);
  if (habitId === null) return;
  if (payload.goal) {
    await writeGoalAndSchedules(db, habitId, payload.goal);
  }
};

const applyHabitDetailsEdited = async (
  db: AnyDb,
  payload: {
    habitId: string;
    title?: string | null;
    description?: string | null;
    clearDescription?: boolean;
    icon?: string | null;
    clearIcon?: boolean;
  },
): Promise<void> => {
  const habitId = await lookupHabitId(db, payload.habitId);
  if (habitId === null) return;

  const set: Record<string, unknown> = { updatedAt: new Date() };
  if (payload.title != null) set.title = payload.title;
  if (payload.clearDescription) set.description = null;
  else if (payload.description != null) set.description = payload.description;
  if (payload.clearIcon) set.icon = null;
  else if (payload.icon != null) set.icon = payload.icon;
  await db.update(habit).set(set).where(eq(habit.id, habitId));
};

const applyHabitGoalDefined = async (
  db: AnyDb,
  payload: ServerGoal & { habitId: string },
): Promise<void> => {
  const habitId = await lookupHabitId(db, payload.habitId);
  if (habitId === null) return;
  await writeGoalAndSchedules(db, habitId, {
    regularity: payload.regularity,
    frequency: payload.frequency,
    schedules: payload.schedules,
  });
};

const applyHabitGoalCleared = async (
  db: AnyDb,
  payload: { habitId: string },
): Promise<void> => {
  const habitId = await lookupHabitId(db, payload.habitId);
  if (habitId === null) return;
  await db.delete(goal).where(eq(goal.habitId, habitId));
};

const applyHabitDeleted = async (
  db: AnyDb,
  payload: { habitId: string },
): Promise<void> => {
  await db.delete(habit).where(eq(habit.externalId, payload.habitId));
};

const applyCheckInRecorded = async (
  db: AnyDb,
  payload: {
    checkInId: string;
    habitId: string;
    timestamp: string;
    skipped?: boolean | null;
  },
): Promise<void> => {
  const habitId = await lookupHabitId(db, payload.habitId);
  if (habitId === null) return;
  await db
    .insert(checkIn)
    .values({
      externalId: payload.checkInId,
      habitId,
      timestamp: new Date(payload.timestamp),
      skipped: payload.skipped ?? false,
    })
    .onConflictDoUpdate({
      target: checkIn.externalId,
      set: {
        habitId,
        timestamp: new Date(payload.timestamp),
        skipped: payload.skipped ?? false,
        updatedAt: new Date(),
      },
    });
};

const applyCheckInMoved = async (
  db: AnyDb,
  payload: {
    checkInId: string;
    newTimestamp: string;
  },
): Promise<void> => {
  // No-op if the row is missing locally — the original CreateCheckIn may
  // not have replayed yet, or the row was deleted by a later event.
  await db
    .update(checkIn)
    .set({
      timestamp: new Date(payload.newTimestamp),
      updatedAt: new Date(),
    })
    .where(eq(checkIn.externalId, payload.checkInId));
};

const applyCheckInSkipChanged = async (
  db: AnyDb,
  payload: { checkInId: string },
  skipped: boolean,
): Promise<void> => {
  await db
    .update(checkIn)
    .set({ skipped, updatedAt: new Date() })
    .where(eq(checkIn.externalId, payload.checkInId));
};

const applyCheckInDeleted = async (
  db: AnyDb,
  payload: { checkInId: string },
): Promise<void> => {
  await db.delete(checkIn).where(eq(checkIn.externalId, payload.checkInId));
};

/**
 * Applies one server-shipped event envelope to the local DB and advances
 * `sync_state.highest_server_sequence` to the envelope's sequence — all
 * in one transaction so a crash mid-apply rolls back both the data write
 * and the high-water mark bump. Apply handlers are upsert-shaped and
 * tolerate "target missing" so replays and out-of-order arrivals are safe.
 *
 * Does NOT write to `outbox`: these events originated from the server,
 * not from a local user action.
 */
export const applyServerEvent = async (
  db: AnyDb,
  envelope: ServerEvent,
): Promise<void> =>
  withTransaction(db, async () => {
    const payload = envelope.payload as Record<string, unknown>;
    switch (envelope.type) {
      case "HabitCreated":
        await applyHabitCreated(
          db,
          payload as Parameters<typeof applyHabitCreated>[1],
        );
        break;
      case "HabitDetailsEdited":
        await applyHabitDetailsEdited(
          db,
          payload as Parameters<typeof applyHabitDetailsEdited>[1],
        );
        break;
      case "HabitGoalDefined":
        await applyHabitGoalDefined(
          db,
          payload as Parameters<typeof applyHabitGoalDefined>[1],
        );
        break;
      case "HabitGoalCleared":
        await applyHabitGoalCleared(
          db,
          payload as Parameters<typeof applyHabitGoalCleared>[1],
        );
        break;
      case "HabitDeleted":
        await applyHabitDeleted(
          db,
          payload as Parameters<typeof applyHabitDeleted>[1],
        );
        break;
      case "CheckInRecorded":
        await applyCheckInRecorded(
          db,
          payload as Parameters<typeof applyCheckInRecorded>[1],
        );
        break;
      case "CheckInMoved":
        await applyCheckInMoved(
          db,
          payload as Parameters<typeof applyCheckInMoved>[1],
        );
        break;
      case "CheckInMarkedSkipped":
        await applyCheckInSkipChanged(
          db,
          payload as { checkInId: string },
          true,
        );
        break;
      case "CheckInMarkedDone":
        await applyCheckInSkipChanged(
          db,
          payload as { checkInId: string },
          false,
        );
        break;
      case "CheckInDeleted":
        await applyCheckInDeleted(
          db,
          payload as Parameters<typeof applyCheckInDeleted>[1],
        );
        break;
      default:
        throw new Error(
          `applyServerEvent: unknown envelope type "${envelope.type}"`,
        );
    }

    if (envelope.sequence !== undefined && envelope.sequence !== null) {
      const seq = envelope.sequence;
      await db
        .update(syncState)
        .set({
          highestServerSequence: sql`MAX(${syncState.highestServerSequence}, ${seq})`,
        })
        .where(eq(syncState.id, 1));
    }
  });
