import { sql } from "drizzle-orm";
import { blob, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

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
  id: integer("id").primaryKey({ autoIncrement: true }),
  subreddit: text("subreddit")
    .notNull()
    .references(() => trackedSubredditsTable.subreddit),
  last_offset: text("last_offset"),
  last_sync_at: text("last_sync_at"),
  ...timestamps,
});

export const trackedSubredditsTable = sqliteTable("tracked_subreddits", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  subreddit: text("subreddit").notNull().unique(),
  is_active: integer("is_active", { mode: "boolean" }).notNull().default(true),
  ...timestamps,
});

// Define modqueueTable *once*, including all columns.
export const modqueueItemsTable = sqliteTable("modqueue_items", {
  id: integer("id").notNull().primaryKey({ autoIncrement: true }),
  subreddit: text("subreddit").notNull(),
  author: text("author").notNull(),
  permalink: text("permalink"),
  type: text("type").notNull(),
  raw_data: blob("raw_data", { mode: "json" }),
  ...timestamps,
});
