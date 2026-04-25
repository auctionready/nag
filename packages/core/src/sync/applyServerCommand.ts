import { sql, eq } from "drizzle-orm";
import { habit, goal, schedule, checkIn, syncState } from "@nag/schema";
import type { AnyDb } from "../db";

/**
 * Server-shipped command envelope as it arrives over `/sync` replay. Loose
 * shape — the type discriminator drives our switch and the payload is
 * narrowed at apply time. `sequence` is required in practice but typed
 * optional to match the upstream Zodios schema.
 */
export type ServerCommand = {
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

const applyCreateHabit = async (
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
  // CreateHabit (e.g. our own command echoed back, or a redelivery on
  // resume) is a no-op rather than a constraint violation.
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

const applyUpdateHabit = async (
  db: AnyDb,
  payload: {
    habitId: string;
    title?: string;
    description?: string | null;
    icon?: string | null;
    clearDescription?: boolean;
    clearIcon?: boolean;
    clearGoal?: boolean;
    goal?: ServerGoal | null;
  },
): Promise<void> => {
  const habitId = await lookupHabitId(db, payload.habitId);
  if (habitId === null) {
    // Tolerate target-missing: the row may have been deleted by a later
    // command in the same replay window, or never existed locally yet.
    return;
  }

  const set: Record<string, unknown> = { updatedAt: new Date() };
  if (payload.title !== undefined) set.title = payload.title;
  if (payload.clearDescription) set.description = null;
  else if (payload.description !== undefined)
    set.description = payload.description;
  if (payload.clearIcon) set.icon = null;
  else if (payload.icon !== undefined) set.icon = payload.icon;
  await db.update(habit).set(set).where(eq(habit.id, habitId));

  if (payload.clearGoal) {
    await db.delete(goal).where(eq(goal.habitId, habitId));
  } else if (payload.goal) {
    await writeGoalAndSchedules(db, habitId, payload.goal);
  }
};

const applyDeleteHabit = async (
  db: AnyDb,
  payload: { habitId: string },
): Promise<void> => {
  await db.delete(habit).where(eq(habit.externalId, payload.habitId));
};

const applyCreateCheckIn = async (
  db: AnyDb,
  payload: {
    checkInId: string;
    habitId: string;
    timestamp: string;
    skipped?: boolean | null;
  },
): Promise<void> => {
  const habitId = await lookupHabitId(db, payload.habitId);
  if (habitId === null) {
    // Habit deleted (or never seen). Drop the check-in — without an FK
    // target it can't be persisted.
    return;
  }
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

const applyUpdateCheckIn = async (
  db: AnyDb,
  payload: {
    checkInId: string;
    timestamp: string;
    skipped?: boolean | null;
  },
): Promise<void> => {
  const set: Record<string, unknown> = {
    timestamp: new Date(payload.timestamp),
    updatedAt: new Date(),
  };
  if (payload.skipped !== undefined && payload.skipped !== null) {
    set.skipped = payload.skipped;
  }
  // No-op if missing — drizzle's update returns silently when no rows match.
  await db
    .update(checkIn)
    .set(set)
    .where(eq(checkIn.externalId, payload.checkInId));
};

const applyDeleteCheckIn = async (
  db: AnyDb,
  payload: { checkInId: string },
): Promise<void> => {
  await db.delete(checkIn).where(eq(checkIn.externalId, payload.checkInId));
};

/**
 * Applies one server-shipped command envelope to the local DB and advances
 * `sync_state.highest_server_sequence` to the envelope's sequence — all in
 * one `BEGIN`/`COMMIT` so a crash mid-apply rolls back both the data write
 * and the high-water mark bump. Server-apply handlers are upsert-shaped and
 * tolerate "target missing" so replays and out-of-order arrivals are safe.
 *
 * Does NOT write to `outbox`: these commands originated from the server,
 * not from a local user action.
 */
export const applyServerCommand = async (
  db: AnyDb,
  envelope: ServerCommand,
): Promise<void> => {
  await db.run(sql`BEGIN`);
  try {
    const payload = envelope.payload as Record<string, unknown>;
    switch (envelope.type) {
      case "CreateHabit":
        await applyCreateHabit(
          db,
          payload as Parameters<typeof applyCreateHabit>[1],
        );
        break;
      case "UpdateHabit":
        await applyUpdateHabit(
          db,
          payload as Parameters<typeof applyUpdateHabit>[1],
        );
        break;
      case "DeleteHabit":
        await applyDeleteHabit(
          db,
          payload as Parameters<typeof applyDeleteHabit>[1],
        );
        break;
      case "CreateCheckIn":
        await applyCreateCheckIn(
          db,
          payload as Parameters<typeof applyCreateCheckIn>[1],
        );
        break;
      case "UpdateCheckIn":
        await applyUpdateCheckIn(
          db,
          payload as Parameters<typeof applyUpdateCheckIn>[1],
        );
        break;
      case "DeleteCheckIn":
        await applyDeleteCheckIn(
          db,
          payload as Parameters<typeof applyDeleteCheckIn>[1],
        );
        break;
      default:
        throw new Error(
          `applyServerCommand: unknown envelope type "${envelope.type}"`,
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

    await db.run(sql`COMMIT`);
  } catch (e) {
    await db.run(sql`ROLLBACK`);
    throw e;
  }
};
