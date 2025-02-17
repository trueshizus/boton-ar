import { describe, expect, it, mock } from "bun:test";
import db from "../src/db";
import { trackedSubredditsTable } from "../src/db/schema";
import app from "../src/server";
import mockClient from "../test/mocks/reddit-api-client";
import { MockQueue } from "../test/mocks/redis";

mock.module("../src/services/reddit-api-client", () => mockClient);

mock.module("../src/workers/modqueue-worker", () => {
  return {
    modqueueQueue: new MockQueue("modqueue", () => Promise.resolve()),
  };
});

describe("Subreddit API", () => {
  describe("GET /api/subreddits", () => {
    it("should return empty array when no subreddits are tracked", async () => {
      const req = new Request("http://localhost:3000/api/subreddits");
      const res = await app.fetch(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual([]);
    });
    it("should return tracked subreddits when present", async () => {
      await db.insert(trackedSubredditsTable).values({
        subreddit: "testsubreddit",
        is_active: true,
      });
      const req = new Request("http://localhost:3000/api/subreddits");
      const res = await app.fetch(req);
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data).toHaveLength(1);
      expect(data[0].subreddit).toBe("testsubreddit");
      expect(data[0].is_active).toBe(true);
    });
  });
  describe("POST /api/subreddits", () => {
    it("should successfully add a new subreddit", async () => {
      const req = new Request("http://localhost:3000/api/subreddits", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ subreddit: "testsubreddit" }),
      });
      const res = await app.fetch(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.status).toBe("success");
      expect(data.result).toHaveLength(1);
      expect(data.result[0].subreddit).toBe("testsubreddit");
      expect(data.result[0].is_active).toBe(true);
      const dbResult = await db.select().from(trackedSubredditsTable);
      expect(dbResult).toHaveLength(1);
    });
    it("should return 400 when subreddit name is invalid", async () => {
      const req = new Request("http://localhost:3000/api/subreddits", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ subreddit: "" }),
      });
      const res = await app.fetch(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data).toEqual({
        status: "error",
        message: "Subreddit name is required",
      });
    });
    it("should return 409 when subreddit is already tracked", async () => {
      await db.insert(trackedSubredditsTable).values({
        subreddit: "testsubreddit",
        is_active: true,
      });
      const req = new Request("http://localhost:3000/api/subreddits", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ subreddit: "testsubreddit" }),
      });
      const res = await app.fetch(req);
      expect(res.status).toBe(409);
      const data = await res.json();
      expect(data).toEqual({
        status: "error",
        message: "Subreddit is already being tracked",
      });
    });
  });

  describe("GET /api/subreddits/:subreddit", () => {
    it("should return 404 when subreddit is not tracked", async () => {
      const req = new Request(
        "http://localhost:3000/api/subreddits/testsubreddit"
      );
      const res = await app.fetch(req);
      expect(res.status).toBe(404);
    });
    it("should return subreddit when tracked", async () => {
      await db.insert(trackedSubredditsTable).values({
        subreddit: "testsubreddit",
        is_active: true,
      });
      const req = new Request(
        "http://localhost:3000/api/subreddits/testsubreddit"
      );
      const res = await app.fetch(req);
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data).toHaveLength(1);
      expect(data[0].subreddit).toBe("testsubreddit");
      expect(data[0].is_active).toBe(true);
    });
  });
});
