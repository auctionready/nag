import { type InferInsertModel } from "drizzle-orm";
import { subDays } from "date-fns";
import { habit, goal, checkIn } from "@nag/schema";
import { db } from "./index";

type HabitInsert = Omit<
  InferInsertModel<typeof habit>,
  "id" | "createdAt" | "updatedAt"
>;
type GoalInsert = Omit<
  InferInsertModel<typeof goal>,
  "id" | "habitId" | "createdAt" | "updatedAt"
>;

interface SeedEntry {
  habit: HabitInsert;
  goal?: GoalInsert;
  checkIns?: { daysAgo: number }[];
}

// ── Sample data ──────────────────────────────────────────────────────
// Edit this array to change what gets seeded.
// daysAgo: 0 = today, 1 = yesterday, etc.

const sampleData: SeedEntry[] = [
  {
    habit: { title: "Meditate" },
    goal: { regularity: "day", frequency: 1 },
    checkIns: [{ daysAgo: 0 }],
  },
  {
    habit: { title: "Exercise" },
    goal: { regularity: "day", frequency: 2 },
    checkIns: [{ daysAgo: 0 }],
  },
  {
    habit: { title: "Read" },
    goal: { regularity: "day", frequency: 1 },
    checkIns: [],
  },
  {
    habit: { title: "Journal" },
    goal: { regularity: "week", frequency: 5 },
    checkIns: [
      { daysAgo: 0 },
      { daysAgo: 1 },
      { daysAgo: 2 },
      { daysAgo: 3 },
      { daysAgo: 5 },
    ],
  },
  {
    habit: { title: "Run 5k" },
    goal: { regularity: "week", frequency: 3 },
    checkIns: [{ daysAgo: 1 }],
  },
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
  {
    habit: { title: "Stretch" },
    checkIns: [{ daysAgo: 0 }],
  },
];

// ── Functions ────────────────────────────────────────────────────────

export async function clearAll() {
  await db.delete(checkIn);
  await db.delete(goal);
  await db.delete(habit);
}

export async function seedSampleData() {
  const now = new Date();
  const goalCreatedAt = subDays(now, 30);

  for (const entry of sampleData) {
    const [inserted] = await db
      .insert(habit)
      .values(entry.habit)
      .returning({ id: habit.id });

    if (entry.goal) {
      await db.insert(goal).values({
        ...entry.goal,
        habitId: inserted.id,
        createdAt: goalCreatedAt,
        updatedAt: goalCreatedAt,
      });
    }

    if (entry.checkIns) {
      for (const ci of entry.checkIns) {
        const timestamp = subDays(now, ci.daysAgo);
        await db.insert(checkIn).values({ habitId: inserted.id, timestamp });
      }
    }
  }
}
