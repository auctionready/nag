import { beforeAll, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import {
  drizzle,
  type BetterSQLite3Database,
} from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import Database from "better-sqlite3";
import { unlinkSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";
import * as schema from "@nag/schema";

type TestDb = BetterSQLite3Database<typeof schema>;

export function setupTestDb(name: string): () => TestDb {
  let db: TestDb;

  beforeAll(() => {
    const sqlite = new Database(name);
    sqlite.pragma("foreign_keys = ON");
    db = drizzle(sqlite, { schema });
    const __dirname = dirname(fileURLToPath(import.meta.url));
    migrate(db, {
      migrationsFolder: resolve(__dirname, "../../../schema/drizzle"),
    });

    return () => {
      sqlite.close();
      try {
        unlinkSync(name);
      } catch {}
    };
  });

  beforeEach(async () => {
    await db.delete(schema.outbox);
    await db.delete(schema.schedule);
    await db.delete(schema.checkIn);
    await db.delete(schema.goal);
    await db.delete(schema.habit);
    // sync_state is a single-row flag table; reset its state instead of
    // deleting the row (the row is seeded by migration 0008).
    await db
      .update(schema.syncState)
      .set({ halted: false, paused: false, highestServerSequence: 0 })
      .where(eq(schema.syncState.id, 1));
    // identity is also single-row but unseeded by migration — every test
    // starts from a registered device unless the test explicitly clears it.
    await db.delete(schema.identity);
    await db.insert(schema.identity).values({
      id: 1,
      deviceId: "00000000-0000-4000-8000-000000000001",
      accountId: "00000000-0000-4000-8000-0000000000aa",
      registeredAt: new Date("2026-01-01T00:00:00.000Z"),
    });
  });

  return () => db;
}
