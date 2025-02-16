import { afterAll, beforeAll, beforeEach } from "bun:test";
import db from "../../src/db";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { sql } from "drizzle-orm";

globalThis.$ADZE_ENV = "test";

beforeAll(() => {
  migrate(db, { migrationsFolder: "./drizzle" });
});

beforeEach(() => {
  const queries = ["DELETE FROM tracked_subreddits"];

  queries.forEach((q) => db.run(sql.raw(q)));
});

afterAll(() => {
  db.$client.close();
});
