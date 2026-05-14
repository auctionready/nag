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
  AllDays,
  Day,
  WeekDays,
  WeekendDays,
  getConsolidatedScheduler,
  getNotificationScheduler,
  processCommand,
  setConsolidatedScheduler,
  setNotificationScheduler,
  syncAllNotifications,
  type CreateHabit,
  type GoalPayload,
  type TokenStore,
} from "@nag/core";
import { db } from "./index";

// ── Day helpers ─────────────────────────────────────────────────────
const MWF = Day.Mon | Day.Wed | Day.Fri;
const TuTh = Day.Tue | Day.Thu;
const MW = Day.Mon | Day.Wed;

// ── Pattern-based check-in generator ────────────────────────────────
// Personas have realistic histories with mixed completions, skips, and
// misses. A pattern controls the completion rate and how often a
// completion is recorded as a skip. Pattern arrays split the history
// into equal phases — `["solid", "patchyMissing"]` is "solid then
// faded".

type Pattern =
  | "solid"
  | "fewMisses"
  | "patchyMissing"
  | "patchySkipping"
  | "sparse";

const patternConfigs: Record<
  Pattern,
  { completionRate: number; skipRatio: number }
> = {
  solid: { completionRate: 0.92, skipRatio: 0.05 },
  fewMisses: { completionRate: 0.78, skipRatio: 0.1 },
  patchyMissing: { completionRate: 0.45, skipRatio: 0.1 },
  patchySkipping: { completionRate: 0.55, skipRatio: 0.55 },
  sparse: { completionRate: 0.25, skipRatio: 0.15 },
};

// Tiny deterministic PRNG (mulberry32) — same seed gives same history.
const mulberry32 = (seed: number) => () => {
  let t = (seed = (seed + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

interface HistoryConfig {
  startDaysAgo: number;
  endDaysAgo?: number;
  pattern: Pattern | Pattern[];
  /** Ignore scheduled days — one slot per calendar day. */
  anyDay?: boolean;
  seed: number;
}

interface GeneratedCheckIn {
  daysAgo: number;
  skipped?: boolean;
}

const generateCheckIns = (
  schedules: readonly { days: number }[],
  cfg: HistoryConfig,
  now: Date,
): GeneratedCheckIn[] => {
  const rng = mulberry32(cfg.seed);
  const end = cfg.endDaysAgo ?? 0;
  const span = cfg.startDaysAgo - end + 1;
  const patterns = Array.isArray(cfg.pattern) ? cfg.pattern : [cfg.pattern];
  const result: GeneratedCheckIn[] = [];

  for (let i = 0; i < span; i++) {
    const daysAgo = cfg.startDaysAgo - i;
    const date = subDays(now, daysAgo);
    const phaseIdx = Math.min(
      Math.floor((i / span) * patterns.length),
      patterns.length - 1,
    );
    const phase = patternConfigs[patterns[phaseIdx]];

    const slots = cfg.anyDay
      ? 1
      : schedules.reduce(
          (n, s) => n + ((s.days & (1 << date.getDay())) !== 0 ? 1 : 0),
          0,
        );

    for (let s = 0; s < slots; s++) {
      if (rng() > phase.completionRate) continue;
      const skipped = rng() < phase.skipRatio;
      result.push(skipped ? { daysAgo, skipped: true } : { daysAgo });
    }
  }
  return result;
};

const goalSchedules = (
  command: Omit<CreateHabit, "habitId">,
): { days: number }[] => {
  const g = command.goal;
  if (!g || g.regularity !== "week" || !g.schedules) return [];
  return g.schedules.map((s) => ({ days: s.days }));
};

// ── Sample data ──────────────────────────────────────────────────────
// Persona "Sam" — picked up a few habits over the last two months,
// some sticking better than others. Mix of solid streaks, fading
// resolve, fresh starts, and a goal change mid-stream. Edit freely.

interface SeedEntry {
  command: Omit<CreateHabit, "habitId">;
  /** How many days ago the (current) goal was created. Defaults to 30. */
  goalDaysAgo?: number;
  /** Generated history. */
  history?: HistoryConfig;
  /** Hand-picked extras on top of generated ones. */
  checkIns?: GeneratedCheckIn[];
  /** Applies an UpdateHabit partway through and re-stamps goal.createdAt. */
  update?: { daysAgo: number; goal: GoalPayload };
}

const sampleData: SeedEntry[] = [
  // Rock-solid — 60-day daily meditation streak with a handful of misses.
  {
    command: {
      type: "CreateHabit",
      title: "Meditate",
      goal: {
        regularity: "week",
        schedules: [{ hour: 7, minute: 0, days: AllDays }],
      },
    },
    goalDaysAgo: 60,
    history: {
      startDaysAgo: 60,
      pattern: "solid",
      anyDay: true,
      seed: 11,
    },
  },
  // Started strong, faded — twice-daily weekday workouts now slipping.
  {
    command: {
      type: "CreateHabit",
      title: "Exercise",
      goal: {
        regularity: "week",
        schedules: [
          { hour: 6, minute: 30, days: WeekDays },
          { hour: 18, minute: 0, days: WeekDays },
        ],
      },
    },
    goalDaysAgo: 60,
    history: {
      startDaysAgo: 60,
      pattern: ["solid", "fewMisses", "patchyMissing"],
      seed: 22,
    },
  },
  // Just created — no history yet.
  {
    command: {
      type: "CreateHabit",
      title: "Read",
      goal: {
        regularity: "week",
        schedules: [{ hour: 21, minute: 0, days: AllDays }],
      },
    },
    goalDaysAgo: 1,
  },
  // Patchy, lots of skips — journaling never quite landed.
  {
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
    goalDaysAgo: 45,
    history: {
      startDaysAgo: 45,
      pattern: "patchySkipping",
      seed: 33,
    },
  },
  // Goal change — used to be 3×/week (MWF), dropped to 2×/week (MW)
  // about 25 days ago when the Friday runs kept getting missed.
  {
    command: {
      type: "CreateHabit",
      title: "Run 5k",
      goal: {
        regularity: "week",
        schedules: [{ hour: 6, minute: 0, days: MWF }],
      },
    },
    goalDaysAgo: 60,
    history: {
      startDaysAgo: 60,
      pattern: ["fewMisses", "patchyMissing"],
      seed: 44,
    },
    update: {
      daysAgo: 25,
      goal: {
        regularity: "week",
        schedules: [{ hour: 6, minute: 0, days: MW }],
      },
    },
  },
  // Weekend-only — guitar with plenty of skips.
  {
    command: {
      type: "CreateHabit",
      title: "Practice guitar",
      goal: {
        regularity: "week",
        schedules: [{ hour: 10, minute: 0, days: WeekendDays }],
      },
    },
    goalDaysAgo: 60,
    history: {
      startDaysAgo: 60,
      pattern: "patchySkipping",
      seed: 55,
    },
  },
  // Fresh — solid 10-day streak on a 3-slot weekday habit.
  {
    command: {
      type: "CreateHabit",
      title: "Drink water",
      goal: {
        regularity: "week",
        schedules: [
          { hour: 8, minute: 0, days: WeekDays },
          { hour: 12, minute: 30, days: WeekDays },
          { hour: 17, minute: 0, days: WeekDays },
        ],
      },
    },
    goalDaysAgo: 10,
    history: {
      startDaysAgo: 10,
      pattern: "solid",
      seed: 66,
    },
  },
  // Consistent monthly habit — 4×/month for two months, hand-picked.
  {
    command: {
      type: "CreateHabit",
      title: "Call family",
      goal: { regularity: "month", frequency: 4 },
    },
    goalDaysAgo: 60,
    checkIns: [
      { daysAgo: 2 },
      { daysAgo: 10 },
      { daysAgo: 17 },
      { daysAgo: 26 },
      { daysAgo: 33 },
      { daysAgo: 41 },
      { daysAgo: 49 },
      { daysAgo: 58 },
    ],
  },
  // No goal — freeform stretching, sporadic.
  {
    command: { type: "CreateHabit", title: "Stretch" },
    checkIns: [
      { daysAgo: 0 },
      { daysAgo: 2 },
      { daysAgo: 5 },
      { daysAgo: 12 },
      { daysAgo: 18, skipped: true },
      { daysAgo: 24 },
    ],
  },
  // Recent solid daily habit — washing dishes after dinner.
  {
    command: {
      type: "CreateHabit",
      title: "Wash dishes",
      goal: {
        regularity: "week",
        schedules: [{ hour: 19, minute: 30, days: AllDays }],
      },
    },
    goalDaysAgo: 20,
    history: {
      startDaysAgo: 20,
      pattern: "fewMisses",
      anyDay: true,
      seed: 77,
    },
  },
  // Started keen then gave up — phone-free evenings, very sparse lately.
  {
    command: {
      type: "CreateHabit",
      title: "Phone-free evening",
      goal: {
        regularity: "week",
        schedules: [{ hour: 20, minute: 0, days: AllDays }],
      },
    },
    goalDaysAgo: 50,
    history: {
      startDaysAgo: 50,
      pattern: ["fewMisses", "sparse"],
      anyDay: true,
      seed: 88,
    },
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
 * doesn't fan out to slow native I/O across hundreds of iterations. After
 * the seed completes we restore the real schedulers and run the sync once.
 * This also reduces the storm of `expo-sqlite` change-listener fires that
 * otherwise makes `useLiveQuery` flicker through partial states on the
 * board screen.
 *
 * Goal-change entries (`update`) run their UpdateHabit *after* the
 * back-dated check-ins are written. The new goal row's `createdAt` is
 * then stamped to `update.daysAgo` so the UI shows the new goal as
 * active from the change date forward. The earlier check-ins remain in
 * place — there's no goal-history table, so they end up displayed
 * against the post-change goal, which is the closest single-row model
 * to "user changed their mind partway through".
 */
export const seedSampleData = async () => {
  const now = new Date();

  const realConsolidated = getConsolidatedScheduler();
  const realNotification = getNotificationScheduler();
  const noopConsolidated = {
    requestPermissions: async () => true,
    cancelAllTimeSlotNotifications: async () => {},
    scheduleTimeSlotNotification: async () => {},
  };
  const noopNotification = {
    cancelNotifications: async () => {},
    syncNotifications: async () => {},
  };
  setConsolidatedScheduler(noopConsolidated);
  setNotificationScheduler(noopNotification);

  // Seed data is for demo/visual purposes — never enable reminders so
  // loading sample data can't trigger the iOS permission prompt or queue
  // real local notifications.
  const withoutReminders = (
    g: GoalPayload | undefined,
  ): GoalPayload | undefined => {
    if (!g || !g.schedules) return g;
    return {
      ...g,
      schedules: g.schedules.map((s) => ({ ...s, reminder: false })),
    };
  };

  try {
    for (const entry of sampleData) {
      const habitId = seqUuid();
      await processCommand(db, {
        ...entry.command,
        habitId,
        goal: withoutReminders(entry.command.goal),
      });

      if (entry.command.goal) {
        const createdAt = subDays(now, entry.goalDaysAgo ?? 30);
        await db
          .update(goal)
          .set({ createdAt, updatedAt: createdAt })
          .where(eq(goal.habitId, habitId));
      }

      const generated = entry.history
        ? generateCheckIns(goalSchedules(entry.command), entry.history, now)
        : [];
      for (const ci of [...generated, ...(entry.checkIns ?? [])]) {
        await processCommand(db, {
          type: "CreateCheckIn",
          checkInId: seqUuid(),
          habitId,
          timestamp: subDays(now, ci.daysAgo),
          skipped: ci.skipped,
        });
      }

      if (entry.update) {
        await processCommand(db, {
          type: "UpdateHabit",
          habitId,
          goal: withoutReminders(entry.update.goal),
        });
        const createdAt = subDays(now, entry.update.daysAgo);
        await db
          .update(goal)
          .set({ createdAt, updatedAt: createdAt })
          .where(eq(goal.habitId, habitId));
      }
    }
  } finally {
    setConsolidatedScheduler(realConsolidated);
    setNotificationScheduler(realNotification);
  }

  await syncAllNotifications(db);
};
