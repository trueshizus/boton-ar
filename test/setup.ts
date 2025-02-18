import { afterAll, afterEach, beforeAll, beforeEach } from "bun:test";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import db, { closeDb } from "../src/db";
import setupMockRedditApi from "./mocks/reddit-api";
import { mock } from "bun-bagel";
globalThis.$ADZE_ENV = "test";
import fetchMock from "./mocks/fetch";

global.fetch = fetchMock;

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

afterEach(() => {
  // mockFetch.mockReset();
});

afterAll(() => {
  closeDb();
});
