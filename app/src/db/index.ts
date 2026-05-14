import * as Sentry from "@sentry/react-native";
import { openDatabaseSync } from "expo-sqlite";
import { drizzle } from "drizzle-orm/expo-sqlite";
import * as schema from "@nag/schema";

const expoDb = Sentry.startSpan({ name: "db.open(listener)", op: "db" }, () =>
  openDatabaseSync("nag.db", { enableChangeListener: true }),
);
export const db = drizzle(expoDb, { schema });

/**
 * Detects a fresh install (or first launch after the dev "Clear whole
 * device" tool dropped every table) by checking whether drizzle's
 * migration tracking table has been created yet. On iOS the SQLite
 * file lives in the app sandbox and is deleted on reinstall, so this
 * is reliable as a "this install is brand new" signal — unlike
 * SecureStore (Keychain), which survives reinstall.
 */
export const isLocalDatabaseEmpty = (): boolean => {
  const row = expoDb.getFirstSync<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='__drizzle_migrations'",
  );
  return row === null;
};

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
