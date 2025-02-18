import { Hono } from "hono";
import db from "./db";
import {
  modqueueItemsTable,
  postsTable,
  syncStatusTable,
  trackedSubredditsTable,
  commentsTable,
} from "./db/schema";
import logger from "./logger";
import subreddits from "./routes/subreddits";
import createClient from "./services/reddit-api-client";

const app = new Hono();
const client = createClient();

app.get("/", async (c) => {
  return c.render("<div>Hello</div>");
});

app.get("/health", (c) => {
  return c.json({ message: "ok" });
});

// clears the db and redis, restarts workers
app.post("/reset", async (c) => {
  await db.delete(trackedSubredditsTable);
  await db.delete(modqueueItemsTable);
  await db.delete(syncStatusTable);
  await db.delete(commentsTable);
  await db.delete(postsTable);

  return c.json({ message: "ok" });
});

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

// // Update approve endpoint to handle cache
// app.post("/api/approve/:thing", async (c) => {
//   try {
//     const thing = c.req.param("thing");
//     if (!thing.match(/^t[1-6]_[a-zA-Z0-9]+$/)) {
//       logger.warn("⚠️ Invalid thing ID format", { thing });
//       return c.json({ error: "Invalid thing ID format" }, 400);
//     }

//     logger.info("👍 Approving content", { thing });
//     const result = await client.approve(thing);

//     logger.info("✅ Successfully approved content", { thing });
//     return c.json(result);
//   } catch (err) {
//     logger.error("❌ Error approving content", {
//       thing: c.req.param("thing"),
//       error: err,
//     });
//     return c.json({ error: "Error approving thing" }, 500);
//   }
// });

// // Update remove endpoint similarly
// app.post("/api/remove/:thing", async (c) => {
//   try {
//     const thing = c.req.param("thing");
//     if (!thing.match(/^t[1-6]_[a-zA-Z0-9]+$/)) {
//       logger.warn("⚠️ Invalid thing ID format", { thing });
//       return c.json({ error: "Invalid thing ID format" }, 400);
//     }

//     logger.info("🚫 Removing content", { thing });
//     const result = await client.remove(thing);

//     logger.info("✅ Successfully removed content", { thing });
//     return c.json(result);
//   } catch (err) {
//     logger.error("❌ Error removing content", {
//       thing: c.req.param("thing"),
//       error: err,
//     });
//     return c.json({ error: "Error removing thing" }, 500);
//   }
// });

// Add rate limiting middleware
// const rateLimiter = new Map<string, number>();
// app.use("*", async (c, next) => {
//   const key = c.req.url;
//   const now = Date.now();
//   const lastRequest = rateLimiter.get(key) || 0;

//   if (now - lastRequest < 1000) {
//     logger.warn("⚠️ Rate limit exceeded", { url: key });
//     return c.json({ error: "Too many requests" }, 429);
//   }

//   rateLimiter.set(key, now);
//   await next();
// });

app.route("/api/subreddits", subreddits);

export default app;
