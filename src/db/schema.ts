import { sql } from "drizzle-orm";
import { blob, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export type SyncType = "modqueue" | "modmail" | "comments" | "posts";
export type ModerationStatus = "pending" | "approved" | "removed" | "ignored";

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
  type: text("type", {
    enum: ["modqueue", "modmail", "comments", "posts"],
  }).notNull(),
  subreddit: text("subreddit")
    .notNull()
    .references(() => trackedSubredditsTable.subreddit),
  last_offset: text("last_offset"),
  ...timestamps,
});

export const trackedSubredditsTable = sqliteTable("tracked_subreddits", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  subreddit: text("subreddit").notNull().unique(),
  is_active: integer("is_active", { mode: "boolean" }).notNull().default(true),
  ...timestamps,
});

export const modqueueItemsTable = sqliteTable("modqueue_items", {
  id: integer("id").notNull().primaryKey({ autoIncrement: true }),
  subreddit: text("subreddit").notNull(),
  author: text("author").notNull(),
  type: text("type").notNull(),
  name: text("name").notNull(),
  raw_data: blob("raw_data", { mode: "json" }),
  status: text("status", {
    enum: ["pending", "approved", "removed", "ignored"],
  })
    .notNull()
    .default("pending"),
  ...timestamps,
});

export const commentsTable = sqliteTable("comments", {
  id: integer("id").notNull().primaryKey({ autoIncrement: true }),
  subreddit: text("subreddit").notNull(),
  author: text("author").notNull(),
  type: text("type").notNull(),
  name: text("name").notNull(),
  raw_data: blob("raw_data", { mode: "json" }),
  ...timestamps,
});

export const postsTable = sqliteTable("posts", {
  id: integer("id").notNull().primaryKey({ autoIncrement: true }),
  subreddit: text("subreddit").notNull(),
  author: text("author").notNull(),
  type: text("type").notNull(),
  name: text("name").notNull(),
  raw_data: blob("raw_data", { mode: "json" }),
  ...timestamps,
});
