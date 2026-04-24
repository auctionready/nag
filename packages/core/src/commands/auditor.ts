import { eq } from "drizzle-orm";
import { auditLog, habit, checkIn } from "@nag/schema";
import type { AnyDb } from "../db";
import type {
  Command,
  CreateHabit,
  UpdateHabit,
  CreateCheckIn,
  UpdateCheckIn,
  GoalPayload,
} from "./schemas";

/**
 * Shape of the handler result needed by the auditor to resolve external UUIDs
 * for the server envelope. Each handler returns this in addition to whatever
 * it returns for app-side callers.
 */
export type HandlerAuditContext = { externalId?: string };

type ServerScheduleEntry = {
  hour: number;
  minute: number;
  days: number | null;
  dayOfMonth: number | null;
  reminder: boolean | null;
};

type ServerGoalPayload = {
  regularity: "day" | "week" | "month";
  frequency: number | null;
  schedules: ServerScheduleEntry[] | null;
};

const mapSchedules = (
  entries: GoalPayload["schedules"],
): ServerScheduleEntry[] | null =>
  entries
    ? entries.map((s) => ({
        hour: s.hour,
        minute: s.minute,
        days: s.days ?? null,
        dayOfMonth: s.dayOfMonth ?? null,
        reminder: s.reminder ?? null,
      }))
    : null;

const mapGoal = (g: GoalPayload): ServerGoalPayload => ({
  regularity: g.regularity,
  frequency: g.frequency ?? null,
  schedules: mapSchedules(g.schedules),
});

async function lookupHabitExternalId(
  db: AnyDb,
  habitId: number,
): Promise<string> {
  const [row] = await db
    .select({ externalId: habit.externalId })
    .from(habit)
    .where(eq(habit.id, habitId));
  if (!row) {
    throw new Error(`audit: habit id=${habitId} not found`);
  }
  return row.externalId;
}

async function lookupCheckInExternalId(
  db: AnyDb,
  checkInId: number,
): Promise<string> {
  const [row] = await db
    .select({ externalId: checkIn.externalId })
    .from(checkIn)
    .where(eq(checkIn.id, checkInId));
  if (!row) {
    throw new Error(`audit: check-in id=${checkInId} not found`);
  }
  return row.externalId;
}

async function buildPayload(
  db: AnyDb,
  command: Command,
  result: HandlerAuditContext,
): Promise<Record<string, unknown>> {
  switch (command.type) {
    case "CreateHabit": {
      const cmd = command as CreateHabit;
      return {
        habitId: result.externalId!,
        title: cmd.title,
        description: cmd.description ?? null,
        icon: null,
        goal: cmd.goal ? mapGoal(cmd.goal) : null,
      };
    }
    case "UpdateHabit": {
      const cmd = command as UpdateHabit;
      const externalId = await lookupHabitExternalId(db, cmd.habitId);
      const payload: Record<string, unknown> = { habitId: externalId };
      if (cmd.title !== undefined) payload.title = cmd.title;
      if (cmd.description === null) {
        payload.clearDescription = true;
      } else if (cmd.description !== undefined) {
        payload.description = cmd.description;
      }
      if (cmd.goal === null) {
        payload.clearGoal = true;
      } else if (cmd.goal !== undefined) {
        payload.goal = mapGoal(cmd.goal);
      }
      return payload;
    }
    case "DeleteHabit": {
      return { habitId: result.externalId! };
    }
    case "CreateCheckIn": {
      const cmd = command as CreateCheckIn;
      const habitExternalId = await lookupHabitExternalId(db, cmd.habitId);
      return {
        checkInId: result.externalId!,
        habitId: habitExternalId,
        timestamp: cmd.timestamp.toISOString(),
        skipped: cmd.skipped ?? null,
      };
    }
    case "UpdateCheckIn": {
      const cmd = command as UpdateCheckIn;
      const externalId = await lookupCheckInExternalId(db, cmd.checkInId);
      const payload: Record<string, unknown> = {
        checkInId: externalId,
        timestamp: cmd.timestamp.toISOString(),
      };
      if (cmd.skipped !== undefined) payload.skipped = cmd.skipped;
      return payload;
    }
    case "DeleteCheckIn": {
      return { checkInId: result.externalId! };
    }
  }
}

/**
 * Translates a locally-committed command into the server-shaped envelope
 * payload and appends it to `audit_log` with `status='pending'`. The
 * dispatcher reads pending rows and POSTs them verbatim. `envelope_id` and
 * `timestamp` are set by the table's `$defaultFn`s.
 */
export async function audit(
  db: AnyDb,
  command: Command,
  result: HandlerAuditContext,
): Promise<void> {
  const payload = await buildPayload(db, command, result);
  await db.insert(auditLog).values({
    commandType: command.type,
    payload: JSON.stringify(payload),
  });
}
