import { eq, ne } from "drizzle-orm";
import { habit, goal, schedule, checkIn, outbox, syncState } from "@nag/schema";
import type { AnyDb } from "../db";
import { withTransaction } from "../db/transaction";

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
 * with the snapshot, drops non-`sent` outbox rows, advances
 * `highest_server_sequence` to `sequenceAtSnapshot`, and clears `halted`.
 * All in one transaction so a crash mid-install rolls back to the prior
 * state.
 *
 * Dropping `pending`/`failed` rows is deliberate: snapshot mode is
 * reserved for "client is far behind" cases (fresh install, long offline).
 * The pull-sync runner always drains the outbox before requesting
 * `/sync`, so any pending commands at this point committed in the brief
 * race window between drain and snapshot apply — a tradeoff the user has
 * accepted to keep the client/server reconciliation cheap.
 *
 * `sent` rows are intentionally preserved: they're the historical ledger
 * a future `disconnectFromCloud` re-flags as `pending` so the user's
 * events can ship to a new server account after a "Remove server data
 * and sign out" + sign-in (possibly on a different backend). Without
 * this, the first snapshot install of any session permanently destroys
 * the ledger and the next disconnect+sign-in has nothing to ship.
 * Per-row growth is bounded by `SENT_OUTBOX_RETAIN_DEFAULT`'s prune in
 * `markSent`.
 */
export const installSnapshot = async (
  db: AnyDb,
  sequenceAtSnapshot: number,
  snapshot: ServerSnapshot,
): Promise<void> =>
  withTransaction(db, async () => {
    // Order matters for FK cascades: schedule → goal → check_in → habit
    // would also work, but a clean truncate of `habit` cascades through
    // `goal`/`schedule`/`check_in` via ON DELETE CASCADE.
    await db.delete(checkIn);
    await db.delete(schedule);
    await db.delete(goal);
    await db.delete(habit);
    // Preserve `sent` rows so a future `disconnectFromCloud` can flip
    // them back to `pending` and re-ship to a new server account.
    await db.delete(outbox).where(ne(outbox.status, "sent"));

    const now = new Date();

    for (const h of snapshot.habits ?? []) {
      await db.insert(habit).values({
        id: h.id,
        title: h.title,
        description: h.description ?? null,
        icon: h.icon ?? null,
      });

      if (h.goal) {
        const [insertedGoal] = await db
          .insert(goal)
          .values({
            habitId: h.id,
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
            id: c.id,
            habitId: h.id,
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
  });
