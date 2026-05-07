import { asc, eq } from "drizzle-orm";
import { checkIn, goal, habit, outbox, schedule, syncState } from "@nag/schema";
import type { AnyDb } from "../db";
import { withTransaction } from "../db/transaction";
import { buildEventEntries } from "../commands/auditor";
import type { CheckInRecorded, HabitCreated } from "../events";

export type RebuildOutboxResult = {
  habitCount: number;
  checkInCount: number;
};

/**
 * Recovery action: nuke the outbox and `sync_state`, then re-emit a synthetic
 * `HabitCreated` per local habit (with its goal + schedules) and a
 * `CheckInRecorded` per local check-in. Existing `externalId` UUIDs are
 * preserved so a wiped server rebuilds projections with the same IDs and
 * dedupe stays sound on retry. Edits and intermediate events are not
 * reconstructed — by design, this is reduced-fidelity. Caller must be signed
 * out so the dispatcher doesn't race with us.
 */
export const rebuildOutbox = async (db: AnyDb): Promise<RebuildOutboxResult> =>
  withTransaction(db, async () => {
    await db.delete(outbox);
    await db
      .update(syncState)
      .set({ halted: false, highestServerSequence: 0 })
      .where(eq(syncState.id, 1));

    const habits = await db
      .select()
      .from(habit)
      .orderBy(asc(habit.createdAt), asc(habit.id));

    for (const h of habits) {
      const [g] = await db
        .select()
        .from(goal)
        .where(eq(goal.habitId, h.id))
        .limit(1);

      let goalPayload: HabitCreated["goal"] = null;
      if (g) {
        const schedules = await db
          .select({
            hour: schedule.hour,
            minute: schedule.minute,
            days: schedule.days,
            dayOfMonth: schedule.dayOfMonth,
            reminder: schedule.reminder,
          })
          .from(schedule)
          .where(eq(schedule.goalId, g.id))
          .orderBy(asc(schedule.id));

        const hasSchedules = schedules.length > 0;
        goalPayload = {
          regularity: g.regularity,
          frequency: hasSchedules ? null : g.frequency,
          schedules: hasSchedules
            ? schedules.map((s) => ({
                hour: s.hour,
                minute: s.minute,
                days: s.days ?? null,
                dayOfMonth: s.dayOfMonth ?? null,
                reminder: s.reminder,
              }))
            : null,
        };
      }

      const event: HabitCreated = {
        type: "HabitCreated",
        habitId: h.externalId,
        title: h.title,
        description: h.description ?? null,
        icon: h.icon ?? null,
        goal: goalPayload,
      };

      await db
        .insert(outbox)
        .values({ events: JSON.stringify(buildEventEntries([event])) });
    }

    const checkIns = await db
      .select({
        externalId: checkIn.externalId,
        habitExternalId: habit.externalId,
        timestamp: checkIn.timestamp,
        skipped: checkIn.skipped,
      })
      .from(checkIn)
      .innerJoin(habit, eq(checkIn.habitId, habit.id))
      .orderBy(asc(checkIn.timestamp), asc(checkIn.id));

    for (const c of checkIns) {
      const event: CheckInRecorded = {
        type: "CheckInRecorded",
        checkInId: c.externalId,
        habitId: c.habitExternalId,
        timestamp: c.timestamp,
        skipped: c.skipped,
      };
      await db
        .insert(outbox)
        .values({ events: JSON.stringify(buildEventEntries([event])) });
    }

    return { habitCount: habits.length, checkInCount: checkIns.length };
  });
