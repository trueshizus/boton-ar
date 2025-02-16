import { describe, expect, it, mock } from "bun:test";
import { trackedSubredditsTable } from "../src/db/schema";
import app from "../src/server";
import mockClient from "./mocks/reddit-api-client";
import db from "../src/db";

mock.module("../src/services/reddit-api-client", mockClient);

describe("Health Check", () => {
  it("GET /health", async () => {
    const req = new Request("http://localhost:3000/health");
    const res = await app.fetch(req);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ message: "ok" });
  });
});

describe("GET /api/me", () => {
  it("should return the user's information", async () => {
    const req = new Request("http://localhost:3000/api/me");
    const res = await app.fetch(req);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.name).toBe("BotonAr");
  });
});

describe("GET /api/subreddits", () => {
  it("should return empty array when no subreddits are tracked", async () => {
    const req = new Request("http://localhost:3000/api/subreddits");
    const res = await app.fetch(req);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json).toEqual([]);
  });

  it("should return tracked subreddits when present", async () => {
    await db.insert(trackedSubredditsTable).values({
      subreddit: "testsubreddit",
      isActive: true,
    });

    const req = new Request("http://localhost:3000/api/subreddits");
    const res = await app.fetch(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toHaveLength(1);
    expect(json[0].subreddit).toBe("testsubreddit");
    expect(json[0].isActive).toBe(true);
  });
});
