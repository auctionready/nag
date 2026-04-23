import * as Sentry from "@sentry/react-native";
import { openDatabaseSync } from "expo-sqlite";
import { drizzle } from "drizzle-orm/expo-sqlite";
import * as schema from "@nag/schema";

const expoDb = Sentry.startSpan({ name: "db.open(listener)", op: "db" }, () =>
  openDatabaseSync("nag.db", { enableChangeListener: true }),
);
export const db = drizzle(expoDb, { schema });
