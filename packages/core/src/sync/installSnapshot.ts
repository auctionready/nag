import { sql, eq } from "drizzle-orm";
import { habit, goal, schedule, checkIn, outbox, syncState } from "@nag/schema";
import type { AnyDb } from "../db";

/**
 * Snapshot shape from `GET /sync` snapshot mode. Mirrors the C# `HomeBoard`
 * read model: a flat list of habits, each with its goal, schedules, and the
 * current period's check-ins. Past-period check-ins are intentionally
 * excluded — calendar/history views rehydrate from server replays as the
 * user pulls more data.
 */
export type ServerSnapshot = {
  habits:
    | {
        id: string;
        title: string;
        description?: string | null;
        icon?: string | null;
        goal: {
          regularity: "day" | "week" | "month";
          frequency: number | null;
        } | null;
        schedules:
          | {
              hour: number;
              minute: number;
              days: number | null;
              dayOfMonth: number | null;
              reminder: boolean;
            }[]
          | null;
        periodCheckIns:
          | {
              id: string;
              timestamp: Date | string;
              skipped: boolean;
            }[]
          | null;
      }[]
    | null;
};

/**
 * Replaces all replicated tables (`habit`, `goal`, `schedule`, `check_in`)
 * with the snapshot, clears the outbox, advances `highest_server_sequence`
 * to `sequenceAtSnapshot`, and clears `halted`. All in one
 * `BEGIN`/`COMMIT` so a crash mid-install rolls back to the prior state.
 *
 * The outbox wipe is deliberate: snapshot mode is reserved for "client is
 * far behind" cases (fresh install, long offline). The pull-sync runner
 * always drains the outbox before requesting `/sync`, so any pending
 * commands at this point committed in the brief race window between drain
 * and snapshot apply — a tradeoff the user has accepted to keep the
 * client/server reconciliation cheap.
 */
export const installSnapshot = async (
  db: AnyDb,
  sequenceAtSnapshot: number,
  snapshot: ServerSnapshot,
): Promise<void> => {
  await db.run(sql`BEGIN`);
  try {
    // Order matters for FK cascades: schedule → goal → check_in → habit
    // would also work, but a clean truncate of `habit` cascades through
    // `goal`/`schedule`/`check_in` via ON DELETE CASCADE.
    await db.delete(checkIn);
    await db.delete(schedule);
    await db.delete(goal);
    await db.delete(habit);
    await db.delete(outbox);

    const now = new Date();

    for (const h of snapshot.habits ?? []) {
      const [insertedHabit] = await db
        .insert(habit)
        .values({
          externalId: h.id,
          title: h.title,
          description: h.description ?? null,
          icon: h.icon ?? null,
        })
        .returning({ id: habit.id });

      if (h.goal) {
        const [insertedGoal] = await db
          .insert(goal)
          .values({
            habitId: insertedHabit.id,
            regularity: h.goal.regularity,
            frequency: h.goal.frequency ?? 1,
          })
          .returning({ id: goal.id });

        if (h.schedules && h.schedules.length > 0) {
          await db.insert(schedule).values(
            h.schedules.map((s) => ({
              goalId: insertedGoal.id,
              hour: s.hour,
              minute: s.minute,
              days: s.days,
              dayOfMonth: s.dayOfMonth,
              reminder: s.reminder,
            })),
          );
        }
      }

      if (h.periodCheckIns && h.periodCheckIns.length > 0) {
        await db.insert(checkIn).values(
          h.periodCheckIns.map((c) => ({
            externalId: c.id,
            habitId: insertedHabit.id,
            timestamp:
              c.timestamp instanceof Date ? c.timestamp : new Date(c.timestamp),
            skipped: c.skipped,
            createdAt: now,
            updatedAt: now,
          })),
        );
      }
    }

    await db
      .update(syncState)
      .set({
        halted: false,
        highestServerSequence: sequenceAtSnapshot,
      })
      .where(eq(syncState.id, 1));

    await db.run(sql`COMMIT`);
  } catch (e) {
    await db.run(sql`ROLLBACK`);
    throw e;
  }
};
