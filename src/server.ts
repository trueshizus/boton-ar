import { Hono } from "hono";
import logger from "./logger";
import client from "./services/reddit-api-client";

import db from "./db";
import { syncStatusTable } from "./db/schema";
import subreddits from "./routes/subreddits";

const app = new Hono();

app.get("/health", (c) => {
  return c.json({ message: "ok" });
});

app.get("/db/status", (c) => {
  const result = db.select().from(syncStatusTable);

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

// logger.info("🚀 Starting server...");
app.route("/api/subreddits", subreddits);

export default app;
