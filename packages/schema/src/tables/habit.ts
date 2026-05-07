import { sqliteTable, text } from "drizzle-orm/sqlite-core";
import { uuid, timestamp } from "../columns";
import { seqUuid } from "../seqUuid";

export const habit = sqliteTable("habit", {
  /**
   * Stable UUID minted by the caller (UI / seed / sync). The same value
   * round-trips through command envelopes to the server, so this is both
   * the local PK and the server-side identity. Stored as a 16-byte BLOB
   * for cheap index compares; surfaced as a canonical 36-char string.
   */
  id: uuid("id").primaryKey().$defaultFn(seqUuid),
  title: text("title").notNull(),
  description: text("description"),
  icon: text("icon"),
  createdAt: timestamp("created_at")
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: timestamp("updated_at")
    .notNull()
    .$defaultFn(() => new Date()),
});
