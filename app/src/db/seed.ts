import { eq, type InferInsertModel } from "drizzle-orm";
import { subDays } from "date-fns";
import {
  habit,
  goal,
  checkIn,
  schedule,
  outbox,
  syncState,
  identity,
} from "@nag/schema";
import { Day, AllDays } from "@nag/core";
import { db } from "./index";

type HabitInsert = Omit<
  InferInsertModel<typeof habit>,
  "id" | "createdAt" | "updatedAt"
>;
type GoalInsert = Omit<
  InferInsertModel<typeof goal>,
  "id" | "habitId" | "createdAt" | "updatedAt"
>;
type ScheduleSlot = { hour: number; minute: number; days: number };

interface SeedEntry {
  habit: HabitInsert;
  goal?: GoalInsert;
  schedules?: ScheduleSlot[];
  checkIns?: { daysAgo: number }[];
}

// ── Day helpers ─────────────────────────────────────────────────────
const Weekdays = Day.Mon | Day.Tue | Day.Wed | Day.Thu | Day.Fri;
const MWF = Day.Mon | Day.Wed | Day.Fri;
const TuTh = Day.Tue | Day.Thu;

// ── Sample data ──────────────────────────────────────────────────────
// Edit this array to change what gets seeded.
// daysAgo: 0 = today, 1 = yesterday, etc.

const sampleData: SeedEntry[] = [
  // Daily, every day at 7am — already done today
  {
    habit: { title: "Meditate" },
    goal: { regularity: "day", frequency: 1 },
    schedules: [{ hour: 7, minute: 0, days: AllDays }],
    checkIns: [{ daysAgo: 0 }],
  },
  // Two slots per day (morning + evening), weekdays only
  {
    habit: { title: "Exercise" },
    goal: { regularity: "day", frequency: 2 },
    schedules: [
      { hour: 6, minute: 30, days: Weekdays },
      { hour: 18, minute: 0, days: Weekdays },
    ],
    checkIns: [{ daysAgo: 0 }],
  },
  // Daily at 9pm, all week — nothing checked in yet
  {
    habit: { title: "Read" },
    goal: { regularity: "day", frequency: 1 },
    schedules: [{ hour: 21, minute: 0, days: AllDays }],
    checkIns: [],
  },
  // MWF mornings + Tue/Thu evenings (5 slots across the week)
  {
    habit: { title: "Journal" },
    goal: { regularity: "week", frequency: 5 },
    schedules: [
      { hour: 8, minute: 0, days: MWF },
      { hour: 20, minute: 0, days: TuTh },
    ],
    checkIns: [
      { daysAgo: 0 },
      { daysAgo: 1 },
      { daysAgo: 2 },
      { daysAgo: 3 },
      { daysAgo: 5 },
    ],
  },
  // 3× per week, scheduled MWF at 6am
  {
    habit: { title: "Run 5k" },
    goal: { regularity: "week", frequency: 3 },
    schedules: [{ hour: 6, minute: 0, days: MWF }],
    checkIns: [{ daysAgo: 1 }],
  },
  // Weekend-only habit, two slots on Sat + Sun
  {
    habit: { title: "Practice guitar" },
    goal: { regularity: "week", frequency: 2 },
    schedules: [{ hour: 10, minute: 0, days: Day.Sat | Day.Sun }],
    checkIns: [{ daysAgo: 3 }],
  },
  // Three slots per day on weekdays (morning, lunch, evening)
  {
    habit: { title: "Drink water" },
    goal: { regularity: "day", frequency: 3 },
    schedules: [
      { hour: 8, minute: 0, days: Weekdays },
      { hour: 12, minute: 30, days: Weekdays },
      { hour: 17, minute: 0, days: Weekdays },
    ],
    checkIns: [{ daysAgo: 0 }, { daysAgo: 0 }],
  },
  // Monthly, no schedule
  {
    habit: { title: "Call family" },
    goal: { regularity: "month", frequency: 4 },
    checkIns: [
      { daysAgo: 2 },
      { daysAgo: 8 },
      { daysAgo: 15 },
      { daysAgo: 22 },
    ],
  },
  // No goal, no schedule — freeform
  {
    habit: { title: "Stretch" },
    checkIns: [{ daysAgo: 0 }],
  },
];

// ── Functions ────────────────────────────────────────────────────────

/**
 * Wipes all replicated data + the outbox and resets sync bookkeeping,
 * leaving the `identity` row (device + account ID) intact. After this
 * runs, the next pull-sync sees `since=0` and so exercises the snapshot
 * install path — useful for end-to-end testing the "fresh install with
 * the same device" flow without re-registering.
 */
export const clearAll = async (opts: { keepDeviceInfo?: boolean } = {}) => {
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
  }
};

export const seedSampleData = async () => {
  const now = new Date();
  const goalCreatedAt = subDays(now, 30);

  for (const entry of sampleData) {
    const [inserted] = await db
      .insert(habit)
      .values(entry.habit)
      .returning({ id: habit.id });

    if (entry.goal) {
      const [insertedGoal] = await db
        .insert(goal)
        .values({
          ...entry.goal,
          habitId: inserted.id,
          createdAt: goalCreatedAt,
          updatedAt: goalCreatedAt,
        })
        .returning({ id: goal.id });

      if (entry.schedules) {
        for (const slot of entry.schedules) {
          await db.insert(schedule).values({
            goalId: insertedGoal.id,
            hour: slot.hour,
            minute: slot.minute,
            days: slot.days,
          });
        }
      }
    }

    if (entry.checkIns) {
      for (const ci of entry.checkIns) {
        const timestamp = subDays(now, ci.daysAgo);
        await db.insert(checkIn).values({ habitId: inserted.id, timestamp });
      }
    }
  }
};
