import { habit, checkIn, goal, schedule, auditLog } from "@nag/schema";
import type { AnyDb } from "../db";

interface Snapshot {
  version: 1;
  exportedAt: string;
  tables: {
    habit: Record<string, unknown>[];
    goal: Record<string, unknown>[];
    check_in: Record<string, unknown>[];
    schedule: Record<string, unknown>[];
    audit_log: Record<string, unknown>[];
  };
}

const DATE_COLUMNS: Record<string, string[]> = {
  habit: ["createdAt", "updatedAt"],
  goal: ["createdAt", "updatedAt"],
  check_in: ["timestamp", "createdAt", "updatedAt"],
  schedule: ["createdAt"],
  audit_log: ["timestamp"],
};

const rehydrateDates = (
  rows: Record<string, unknown>[],
  columns: string[],
): Record<string, unknown>[] =>
  rows.map((row) => {
    const out = { ...row };
    for (const col of columns) {
      if (typeof out[col] === "string") {
        out[col] = new Date(out[col] as string);
      }
    }
    return out;
  });

export const exportSnapshot = async (db: AnyDb): Promise<string> => {
  const [habits, goals, checkIns, schedules, auditLogs] = await Promise.all([
    db.select().from(habit),
    db.select().from(goal),
    db.select().from(checkIn),
    db.select().from(schedule),
    db.select().from(auditLog),
  ]);

  const snapshot: Snapshot = {
    version: 1,
    exportedAt: new Date().toISOString(),
    tables: {
      habit: habits,
      goal: goals,
      check_in: checkIns,
      schedule: schedules,
      audit_log: auditLogs,
    },
  };

  return JSON.stringify(snapshot);
};

export const importSnapshot = async (
  db: AnyDb,
  json: string,
): Promise<void> => {
  const snapshot: Snapshot = JSON.parse(json);

  if (snapshot.version !== 1) {
    throw new Error(`Unsupported snapshot version: ${snapshot.version}`);
  }

  const insert = async (
    table: Parameters<typeof db.insert>[0],
    rows: Record<string, unknown>[],
    tableKey: string,
  ) => {
    if (rows.length === 0) return;
    const hydrated = rehydrateDates(rows, DATE_COLUMNS[tableKey] ?? []);
    await db.insert(table).values(hydrated as any);
  };

  // Insert in FK order: parent tables first
  await insert(habit, snapshot.tables.habit, "habit");
  await insert(goal, snapshot.tables.goal, "goal");
  await insert(checkIn, snapshot.tables.check_in, "check_in");
  await insert(schedule, snapshot.tables.schedule, "schedule");
  await insert(auditLog, snapshot.tables.audit_log, "audit_log");
};
