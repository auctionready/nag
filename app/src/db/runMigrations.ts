import * as Sentry from "@sentry/react-native";
import { openDatabaseSync } from "expo-sqlite";
import { drizzle } from "drizzle-orm/expo-sqlite";
import { migrate } from "drizzle-orm/expo-sqlite/migrator";
import migrations from "@nag/schema/migrations";

export const runMigrations = async () =>
  Sentry.startSpan({ name: "db.migrations", op: "db.migrate" }, async () => {
    const raw = Sentry.startSpan(
      { name: "db.open(no-listener)", op: "db" },
      () => openDatabaseSync("nag.db"),
    );
    const migrationDb = drizzle(raw);
    try {
      await Sentry.startSpan(
        { name: "drizzle.migrate", op: "db.migrate" },
        async () => migrate(migrationDb, migrations),
      );
    } finally {
      raw.closeSync();
    }
  });
