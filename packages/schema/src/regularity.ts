import { pgEnum } from "drizzle-orm/pg-core";

export const regularityEnum = pgEnum("regularity", ["day", "week", "month"]);
