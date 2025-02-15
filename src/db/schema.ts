import { sql } from "drizzle-orm";
import { sqliteTable, text, integer, blob } from "drizzle-orm/sqlite-core";

const timestamps = {
  updated_at: text("updated_at")
    .notNull()
    .default(sql`(current_timestamp)`),
  created_at: text("created_at")
    .notNull()
    .default(sql`(current_timestamp)`),
  deleted_at: text("deleted_at"),
};

export const syncStatusTable = sqliteTable("sync_status", {
  id: integer("id").primaryKey(),
  subreddit: text("subreddit")
    .notNull()
    .references(() => trackedSubredditsTable.subreddit),
  lastOffset: text("last_offset"),
  lastSyncAt: text("last_sync_at"),
  ...timestamps,
});

export const modqueueTable = sqliteTable("modqueue", {
  id: integer("id").primaryKey(),
  subreddit: text("subreddit")
    .notNull()
    .references(() => trackedSubredditsTable.subreddit),
  thingId: text("thing_id").notNull().unique(),
  data: blob({ mode: "json" }).notNull(),
  ...timestamps,
});

export const trackedSubredditsTable = sqliteTable("tracked_subreddits", {
  id: integer("id").primaryKey(),
  subreddit: text("subreddit").notNull().unique(),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  ...timestamps,
});
