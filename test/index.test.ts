import { describe, expect, it, mock } from "bun:test";
import { trackedSubredditsTable } from "../src/db/schema";
import app from "../src/server";
import mockClient from "./mocks/reddit-api-client";
import db from "../src/db";

mock.module("../src/services/reddit-api-client", mockClient);

describe("GET /health", () => {
  it("should return 'ok'", async () => {
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

describe("POST /api/subreddits", () => {
  it("should successfully add a new subreddit", async () => {
    const req = new Request("http://localhost:3000/api/subreddits", {
      method: "POST",
      body: JSON.stringify({ subreddit: "testsubreddit" }),
    });

    const res = await app.fetch(req);
    const json = await res.json();
    const result = await db.select().from(trackedSubredditsTable);

    expect(res.status).toBe(201);
    expect(json.status).toBe("success");
    expect(json.result).toHaveLength(1);
    expect(json.result[0].subreddit).toBe("testsubreddit");
    expect(json.result[0].isActive).toBe(true);
  });

  it("should return 400 when subreddit name is invalid", async () => {
    const req = new Request("http://localhost:3000/api/subreddits", {
      method: "POST",
      body: JSON.stringify({ subreddit: "" }),
    });

    const res = await app.fetch(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json).toEqual({
      status: "error",
      message: "Subreddit name is required",
    });
  });

  it("should return 409 when subreddit is already tracked", async () => {
    await db.insert(trackedSubredditsTable).values({
      subreddit: "testsubreddit",
      isActive: true,
    });

    const req = new Request("http://localhost:3000/api/subreddits", {
      method: "POST",
      body: JSON.stringify({ subreddit: "testsubreddit" }),
    });

    const res = await app.fetch(req);
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json).toEqual({
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

  it("should return modqueue when subreddit is tracked", async () => {
    await db.insert(trackedSubredditsTable).values({
      subreddit: "testsubreddit",
      isActive: true,
    });

    const req = new Request(
      "http://localhost:3000/api/subreddits/testsubreddit"
    );
    const res = await app.fetch(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.length).toBe(1);
    expect(json[0].subreddit).toBe("testsubreddit");
    expect(json[0].isActive).toBe(true);
  });
});

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
      isActive: true,
    });

    const req = new Request(
      "http://localhost:3000/api/subreddits/testsubreddit/modqueue"
    );
    const res = await app.fetch(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.kind).toBe("Listing");
    expect(json.data.children).toHaveLength(5);
  });
});
