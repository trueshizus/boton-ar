import { Hono } from "hono";
import logger from "./logger";
import client from "./services/reddit-api-client";
import { sql } from "drizzle-orm";

import db from "./db";
import {
  modqueueTable,
  syncStatusTable,
  trackedSubredditsTable,
} from "./db/schema";
import { addSeedJob, getSeedJobStatus } from "./queue";

const app = new Hono();

app.get("/db/status", (c) => {
  const result = db.select().from(syncStatusTable);

  console.log(result);

  return c.json({ message: "ok" });
});

// Get authenticated user's data.
app.get("/api/me", async (c) => {
  try {
    logger.info("🔍 Fetching authenticated user data");
    const me = await client.me();
    logger.info("✅ Successfully fetched user data");
    return c.json(me);
  } catch (err) {
    logger.error("❌ Error fetching user info", { error: err });
    return c.json({ error: "Error fetching user info" }, 500);
  }
});

// Add a new subreddit to the tracked list.
app.post("/api/subreddit", async (c) => {
  const { subreddit } = await c.req.json();
  const result = await db
    .insert(trackedSubredditsTable)
    .values({ subreddit })
    .returning();

  return c.json({ status: "success", result });
});

// Get the modqueue for a specific subreddit.
app.get("/api/subreddit/:subreddit/modqueue", async (c) => {
  try {
    const { offset } = c.req.query();
    const subreddit = c.req.param("subreddit");
    logger.info(
      `🔍 Fetching modqueue for ${subreddit} with offset ${offset || "empty"}`
    );

    const subredditClient = client.subreddit(subreddit);
    const modqueueListing = await subredditClient.modqueue(offset);

    return c.json(modqueueListing);
  } catch (err) {
    logger.error("❌ Error fetching modqueue", {
      subreddit: c.req.param("subreddit"),
      error: err,
    });
    return c.json({ error: "Error fetching modqueue" }, 500);
  }
});

app.post("/api/subreddit/:subreddit/modqueue/seed", async (c) => {
  const { subreddit } = c.req.param();
  logger.info("🌱 Scheduling modqueue seed", { subreddit });

  try {
    const jobId = await addSeedJob(subreddit);

    return c.json({
      message: "Seed job scheduled",
      jobId,
      status: "pending",
    });
  } catch (err) {
    logger.error("❌ Error scheduling seed job", {
      subreddit,
      error: err,
    });
    return c.json({ error: "Error scheduling seed job" }, 500);
  }
});

app.get("/api/subreddit/:subreddit/modqueue/seed/status/:jobId", async (c) => {
  const { jobId } = c.req.param();
  const status = await getSeedJobStatus(jobId);

  return c.json(status);
});

// Update approve endpoint to handle cache
app.post("/api/approve/:thing", async (c) => {
  try {
    const thing = c.req.param("thing");
    if (!thing.match(/^t[1-6]_[a-zA-Z0-9]+$/)) {
      logger.warn("⚠️ Invalid thing ID format", { thing });
      return c.json({ error: "Invalid thing ID format" }, 400);
    }

    logger.info("👍 Approving content", { thing });
    const result = await client.approve(thing);

    logger.info("✅ Successfully approved content", { thing });
    return c.json(result);
  } catch (err) {
    logger.error("❌ Error approving content", {
      thing: c.req.param("thing"),
      error: err,
    });
    return c.json({ error: "Error approving thing" }, 500);
  }
});

// Update remove endpoint similarly
app.post("/api/remove/:thing", async (c) => {
  try {
    const thing = c.req.param("thing");
    if (!thing.match(/^t[1-6]_[a-zA-Z0-9]+$/)) {
      logger.warn("⚠️ Invalid thing ID format", { thing });
      return c.json({ error: "Invalid thing ID format" }, 400);
    }

    logger.info("🚫 Removing content", { thing });
    const result = await client.remove(thing);

    logger.info("✅ Successfully removed content", { thing });
    return c.json(result);
  } catch (err) {
    logger.error("❌ Error removing content", {
      thing: c.req.param("thing"),
      error: err,
    });
    return c.json({ error: "Error removing thing" }, 500);
  }
});

// Add rate limiting middleware
const rateLimiter = new Map<string, number>();
app.use("*", async (c, next) => {
  const key = c.req.url;
  const now = Date.now();
  const lastRequest = rateLimiter.get(key) || 0;

  if (now - lastRequest < 1000) {
    logger.warn("⚠️ Rate limit exceeded", { url: key });
    return c.json({ error: "Too many requests" }, 429);
  }

  rateLimiter.set(key, now);
  await next();
});

logger.info("🚀 Starting server...");

export default app;
