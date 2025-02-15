import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const syncStatusTable = sqliteTable("sync_status", {
  id: integer("id").primaryKey(),
  subreddit: text("subreddit").notNull(),
  lastOffset: text("last_offset"),
  lastSyncAt: text("last_sync_at"),
});
