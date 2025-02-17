import { beforeEach, describe, expect, it, mock } from "bun:test";
import db from "../src/db";
import { modqueueItemsTable, trackedSubredditsTable } from "../src/db/schema";
import app from "../src/server";
import mockClient from "../test/mocks/reddit-api-client";

mock.module("../src/services/reddit-api-client", () => mockClient);

describe("Modqueue API", () => {
  describe("GET /api/subreddits/:subreddit/modqueue", () => {
    it("should return 404 when subreddit is not tracked", async () => {
      const req = new Request(
        "http://localhost:3000/api/subreddits/testsubreddit/modqueue"
      );
      const res = await app.fetch(req);
      expect(res.status).toBe(404);
    });

    it("should return modqueue when subreddit is tracked", async () => {
      await db.insert(trackedSubredditsTable).values({
        subreddit: "testsubreddit",
        is_active: true,
      });

      await db.insert(modqueueItemsTable).values({
        subreddit: "testsubreddit",
        author: "testauthor",
        type: "t3",
        raw_data: {},
      });

      const req = new Request(
        "http://localhost:3000/api/subreddits/testsubreddit/modqueue"
      );
      const res = await app.fetch(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.pagination.total).toBe(1);
      expect(data.items).toHaveLength(1);
    });
  });

  describe("GET /api/subreddits/:subreddit/modqueue/current", () => {
    it("should return 404 when subreddit is not tracked", async () => {
      const req = new Request(
        "http://localhost:3000/api/subreddits/testsubreddit/modqueue/current"
      );
      const res = await app.fetch(req);
      expect(res.status).toBe(404);
    });

    it("should return modqueue when subreddit is tracked", async () => {
      await db.insert(trackedSubredditsTable).values({
        subreddit: "testsubreddit",
        is_active: true,
      });

      const req = new Request(
        "http://localhost:3000/api/subreddits/testsubreddit/modqueue/current"
      );
      const res = await app.fetch(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.kind).toBe("Listing");
      expect(Array.isArray(data.data.children)).toBe(true);
    });
  });
});
