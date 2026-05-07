import * as Sentry from "@sentry/react-native";
import { openDatabaseSync } from "expo-sqlite";
import { drizzle } from "drizzle-orm/expo-sqlite";
import * as schema from "@nag/schema";

const expoDb = Sentry.startSpan({ name: "db.open(listener)", op: "db" }, () =>
  openDatabaseSync("nag.db", { enableChangeListener: true }),
);
export const db = drizzle(expoDb, { schema });

/**
 * Drops every table including drizzle's `__drizzle_migrations` tracking
 * table, so the next launch (via `DevSettings.reload()`) re-runs the
 * migrator from scratch. Required after a schema-breaking change —
 * `clearAll` only deletes rows, so it can't recover when column types
 * or table shapes change.
 *
 * Uses raw SQL DDL on the live connection rather than closing and
 * deleting the file: file deletion has timing gotchas (WAL files,
 * change-listener subscription) that have left old schema in place
 * across reloads.
 */
export const resetDatabaseSchema = (): void => {
  expoDb.execSync(`
    PRAGMA foreign_keys = OFF;
    DROP TABLE IF EXISTS check_in;
    DROP TABLE IF EXISTS schedule;
    DROP TABLE IF EXISTS goal;
    DROP TABLE IF EXISTS habit;
    DROP TABLE IF EXISTS outbox;
    DROP TABLE IF EXISTS sync_state;
    DROP TABLE IF EXISTS identity;
    DROP TABLE IF EXISTS __drizzle_migrations;
    PRAGMA foreign_keys = ON;
  `);
};
