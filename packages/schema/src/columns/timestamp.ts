import { customType } from "drizzle-orm/sqlite-core";

/**
 * Stores a `Date` as Unix milliseconds in an INTEGER column. Equivalent
 * to drizzle's `integer(name, { mode: "timestamp_ms" })` but with a
 * shorter call site since every timestamp column in this schema uses
 * the same representation.
 */
export const timestamp = customType<{ data: Date; driverData: number }>({
  dataType: () => "integer",
  toDriver: (value) => value.getTime(),
  fromDriver: (value) => new Date(value),
});
