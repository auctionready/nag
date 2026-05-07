import { eq } from "drizzle-orm";
import { subDays } from "date-fns";
import {
  habit,
  goal,
  checkIn,
  schedule,
  outbox,
  syncState,
  identity,
  seqUuid,
} from "@nag/schema";
import {
  Day,
  getConsolidatedScheduler,
  getNotificationScheduler,
  processCommand,
  setConsolidatedScheduler,
  setNotificationScheduler,
  syncAllNotifications,
  type CreateHabit,
  type TokenStore,
} from "@nag/core";
import { db } from "./index";

interface SeedEntry {
  command: Omit<CreateHabit, "habitId">;
  checkIns?: { daysAgo: number }[];
}

// ── Day helpers ─────────────────────────────────────────────────────
const Weekdays = Day.Mon | Day.Tue | Day.Wed | Day.Thu | Day.Fri;
const MWF = Day.Mon | Day.Wed | Day.Fri;
const TuTh = Day.Tue | Day.Thu;

// ── Sample data ──────────────────────────────────────────────────────
// Edit this array to change what gets seeded. Each entry is a CreateHabit
// command that the seeder fans out via `processCommand`, so the same
// rows that land locally also queue in the outbox and replicate to the
// backend on the next sync.
//
// daysAgo: 0 = today, 1 = yesterday, etc.

const sampleData: SeedEntry[] = [
  {
    // Daily, every day at 7am — already done today.
    command: {
      type: "CreateHabit",
      title: "Meditate",
      goal: {
        regularity: "day",
        schedules: [{ hour: 7, minute: 0 }],
      },
    },
    checkIns: [{ daysAgo: 0 }],
  },
  {
    // Twice a day on weekdays (morning + evening). Modelled as a weekly
    // habit so the schedules can carry day-of-week filters; the handler
    // counts popcount(days) across schedules to derive frequency = 10.
    command: {
      type: "CreateHabit",
      title: "Exercise",
      goal: {
        regularity: "week",
        schedules: [
          { hour: 6, minute: 30, days: Weekdays },
          { hour: 18, minute: 0, days: Weekdays },
        ],
      },
    },
    checkIns: [{ daysAgo: 0 }],
  },
  {
    // Daily at 9pm, all week — nothing checked in yet.
    command: {
      type: "CreateHabit",
      title: "Read",
      goal: {
        regularity: "day",
        schedules: [{ hour: 21, minute: 0 }],
      },
    },
  },
  {
    // MWF mornings + Tue/Thu evenings (5 slots across the week).
    command: {
      type: "CreateHabit",
      title: "Journal",
      goal: {
        regularity: "week",
        schedules: [
          { hour: 8, minute: 0, days: MWF },
          { hour: 20, minute: 0, days: TuTh },
        ],
      },
    },
    checkIns: [
      { daysAgo: 0 },
      { daysAgo: 1 },
      { daysAgo: 2 },
      { daysAgo: 3 },
      { daysAgo: 5 },
    ],
  },
  {
    // 3× per week, scheduled MWF at 6am.
    command: {
      type: "CreateHabit",
      title: "Run 5k",
      goal: {
        regularity: "week",
        schedules: [{ hour: 6, minute: 0, days: MWF }],
      },
    },
    checkIns: [{ daysAgo: 1 }],
  },
  {
    // Weekend-only habit, one slot on Sat + Sun.
    command: {
      type: "CreateHabit",
      title: "Practice guitar",
      goal: {
        regularity: "week",
        schedules: [{ hour: 10, minute: 0, days: Day.Sat | Day.Sun }],
      },
    },
    checkIns: [{ daysAgo: 3 }],
  },
  {
    // Three slots per day on weekdays (morning, lunch, evening).
    command: {
      type: "CreateHabit",
      title: "Drink water",
      goal: {
        regularity: "week",
        schedules: [
          { hour: 8, minute: 0, days: Weekdays },
          { hour: 12, minute: 30, days: Weekdays },
          { hour: 17, minute: 0, days: Weekdays },
        ],
      },
    },
    checkIns: [{ daysAgo: 0 }, { daysAgo: 0 }],
  },
  {
    // Monthly, no schedule — frequency-only goal.
    command: {
      type: "CreateHabit",
      title: "Call family",
      goal: { regularity: "month", frequency: 4 },
    },
    checkIns: [
      { daysAgo: 2 },
      { daysAgo: 8 },
      { daysAgo: 15 },
      { daysAgo: 22 },
    ],
  },
  {
    // No goal, no schedule — freeform.
    command: { type: "CreateHabit", title: "Stretch" },
    checkIns: [{ daysAgo: 0 }],
  },
];

// ── Functions ────────────────────────────────────────────────────────

/**
 * Wipes all replicated data + the outbox and resets sync bookkeeping.
 * Behaviour gated by `opts`:
 *
 *   - `keepDeviceInfo: true` — leaves the `identity` row alone, so the
 *     next pull-sync sees `since=0` against the same accountId and
 *     exercises the snapshot install path. Useful for end-to-end
 *     testing the "fresh install with the same device" flow without
 *     re-registering.
 *   - default (`keepDeviceInfo: false`) — additionally drops the
 *     `identity` row, so the next launch generates a fresh `deviceId`
 *     and re-registers from scratch.
 *   - `tokenStore` — when supplied alongside the default behaviour,
 *     also wipes the secure-store device token. Combine with the
 *     identity row drop to fully simulate a clean reinstall — what the
 *     "Clear whole device" dev menu item uses. No-op when
 *     `keepDeviceInfo: true` (the existing accountId still needs the
 *     token to authenticate).
 */
export const clearAll = async (
  opts: { keepDeviceInfo?: boolean; tokenStore?: TokenStore } = {},
) => {
  await db.delete(checkIn);
  await db.delete(schedule);
  await db.delete(goal);
  await db.delete(habit);
  await db.delete(outbox);
  await db
    .update(syncState)
    .set({ halted: false, highestServerSequence: 0 })
    .where(eq(syncState.id, 1));
  if (!opts.keepDeviceInfo) {
    await db.delete(identity);
    if (opts.tokenStore) {
      await opts.tokenStore.clear();
    }
  }
};

/**
 * Seeds via {@link processCommand} so each habit + check-in lands in the
 * outbox alongside the local row, and the dispatcher replicates them to
 * the backend on the next sync. Goal `createdAt` is then back-dated
 * locally so the UI's compliance windows include the older check-ins;
 * the backend stamps its own ingest time when it receives the command,
 * which is fine because compliance is computed entirely on-device.
 *
 * The notification schedulers are stubbed for the duration of the seed
 * so the post-commit `syncAllNotifications` call (one per `processCommand`)
 * doesn't fan out to slow native I/O across ~20 iterations. After the seed
 * completes we restore the real schedulers and run the sync once. This also
 * reduces the storm of `expo-sqlite` change-listener fires that otherwise
 * makes `useLiveQuery` flicker through partial states on the board screen.
 */
export const seedSampleData = async () => {
  const now = new Date();
  const goalCreatedAt = subDays(now, 30);

  const realConsolidated = getConsolidatedScheduler();
  const realNotification = getNotificationScheduler();
  const noopConsolidated = {
    cancelAllSlotNotifications: async () => {},
    scheduleSlotNotification: async () => {},
  };
  const noopNotification = {
    cancelNotifications: async () => {},
    syncNotifications: async () => {},
  };
  setConsolidatedScheduler(noopConsolidated);
  setNotificationScheduler(noopNotification);

  try {
    for (const entry of sampleData) {
      const habitId = seqUuid();
      await processCommand(db, { ...entry.command, habitId });

      if (entry.command.goal) {
        await db
          .update(goal)
          .set({ createdAt: goalCreatedAt, updatedAt: goalCreatedAt })
          .where(eq(goal.habitId, habitId));
      }

      for (const ci of entry.checkIns ?? []) {
        await processCommand(db, {
          type: "CreateCheckIn",
          checkInId: seqUuid(),
          habitId,
          timestamp: subDays(now, ci.daysAgo),
        });
      }
    }
  } finally {
    setConsolidatedScheduler(realConsolidated);
    setNotificationScheduler(realNotification);
  }

  await syncAllNotifications(db);
};
