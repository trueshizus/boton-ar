import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { afterAll, beforeAll, beforeEach } from "bun:test";
import db, { closeDb } from "../src/db";
import { sql } from "drizzle-orm";
import { trackedSubredditsTable } from "../src/db/schema";
globalThis.$ADZE_ENV = "test";

beforeAll(async () => {
  migrate(db, { migrationsFolder: "./drizzle" });
});

beforeEach(() => {
  const queries = [
    "DELETE FROM modqueue_items",
    "DELETE FROM sync_status",
    "DELETE FROM tracked_subreddits",
  ];

  queries.forEach((q) => db.run(sql.raw(q)));
});

afterAll(() => {
  closeDb();
});
