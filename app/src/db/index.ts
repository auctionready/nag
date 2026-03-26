import { openDatabaseSync } from "expo-sqlite";
import { drizzle } from "drizzle-orm/expo-sqlite";
import * as schema from "@nag/schema";

const expoDb = openDatabaseSync("nag.db", { enableChangeListener: true });
export const db = drizzle(expoDb, { schema });
