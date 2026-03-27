import { beforeAll, beforeEach } from "vitest";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
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
    await db.delete(schema.auditLog);
    await db.delete(schema.schedule);
    await db.delete(schema.checkIn);
    await db.delete(schema.goal);
    await db.delete(schema.habit);
  });

  return () => db;
}
