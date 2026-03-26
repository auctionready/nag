import { customType } from "drizzle-orm/sqlite-core";

export const isoTimestamp = customType<{ data: Date; driverData: string }>({
  dataType: () => "text",
  toDriver: (value: Date) => value.toISOString(),
  fromDriver: (value: string) => new Date(value),
});
