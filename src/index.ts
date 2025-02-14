import { Hono } from "hono";
import client from "./services/reddit-api-client";
import { Cache } from "./services/cache";
import { Scheduler } from "./services/scheduler";
import { db } from "./services/db";
import logger from "./logger";

const app = new Hono();

// Initialize scheduler and cache
const scheduler = Scheduler.getInstance();
const cache = Cache.getInstance();

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

// New endpoint to get cache statistics
app.get("/api/cache/stats", (c) => {
  logger.debug("📊 Retrieving cache statistics");
  const stats = cache.getStats();
  return c.json({
    ...stats,
    oldestEntryAge: Date.now() - stats.oldestEntry,
  });
});

// Get the modqueue for a specific subreddit.
app.get("/api/subreddit/:subreddit/modqueue", async (c) => {
  try {
    const { offset } = c.req.query();
    const subreddit = c.req.param("subreddit");
    logger.info("🔍 Fetching modqueue", { subreddit, offset });

    // Try to get from cache first
    const cachedData = cache.get(`modqueue:${subreddit}`);

    if (cachedData) {
      logger.debug("📦 Returning cached modqueue data", { subreddit });
      return c.json(cachedData);
    }

    logger.debug("🌐 Cache miss, fetching from Reddit API", { subreddit });
    const subredditClient = client.subreddit(subreddit);
    const modqueueListing = await subredditClient.modqueue(offset);
    const modqueue = modqueueListing.data.children.map((redditThing) => ({
      id: redditThing.data.id,
      author: redditThing.data.author,
      created_utc: redditThing.data.created_utc,
      created_at: new Date(redditThing.data.created_utc * 1000).toISOString(),
    }));

    // Start background polling if not already started
    scheduler.startModqueuePolling(subreddit);

    logger.info("✅ Successfully fetched modqueue", {
      subreddit,
      itemCount: modqueue.length,
    });
    return c.json(modqueue);
  } catch (err) {
    logger.error("❌ Error fetching modqueue", {
      subreddit: c.req.param("subreddit"),
      error: err,
    });
    return c.json({ error: "Error fetching modqueue" }, 500);
  }
});

// Poll endpoint for modqueue updates
app.get("/api/subreddit/:subreddit/modqueue/poll", async (c) => {
  try {
    const subreddit = c.req.param("subreddit");
    const lastEvent = await db.getLastEvent(subreddit, "modqueue.poll");
    const after = lastEvent?.data?.after || null;

    const subredditClient = client.subreddit(subreddit);
    const modqueueListing = await subredditClient.modqueue(after);

    // Store the 'after' cursor for next poll
    await db.createEvent({
      type: "modqueue.poll",
      subreddit,
      data: {
        after: modqueueListing.data.after,
        timestamp: Date.now(),
      },
    });

    // Update cache with new data
    const modqueue = modqueueListing.data.children.map((redditThing) => ({
      id: redditThing.data.id,
      author: redditThing.data.author,
      created_utc: redditThing.data.created_utc,
      created_at: new Date(redditThing.data.created_utc * 1000).toISOString(),
    }));

    cache.set(`modqueue:${subreddit}`, modqueue);

    return c.json({ success: true });
  } catch (err) {
    console.error(err);
    return c.text("Error polling modqueue", 500);
  }
});

// Get the full modqueue for a subreddit and store in DB
app.get("/api/subreddit/:subreddit/modqueue/full", async (c) => {
  try {
    const subreddit = c.req.param("subreddit");
    let after: string | null = null;
    let allItems: any[] = [];
    let newItemsCount = 0;

    // Keep fetching until we have all items
    while (true) {
      const subredditClient = client.subreddit(subreddit);
      const modqueueListing = await subredditClient.modqueue(
        after || undefined
      );

      const items = modqueueListing.data.children.map((redditThing) => ({
        id: redditThing.data.id,
        fullname: `${redditThing.kind}_${redditThing.data.id}`,
        author: redditThing.data.author,
        created_utc: redditThing.data.created_utc,
        created_at: new Date(redditThing.data.created_utc * 1000).toISOString(),
        kind: redditThing.kind,
        // Add additional fields based on the type (post or comment)
        ...(redditThing.kind === "t3"
          ? {
              title: redditThing.data.title,
              selftext: redditThing.data.selftext,
            }
          : {
              body: redditThing.data.body,
              link_id: redditThing.data.link_id,
            }),
      }));

      // Filter out items that already exist in the database
      const newItems = [];
      for (const item of items) {
        const exists = await db.itemExists(subreddit, item.fullname);
        if (!exists) {
          newItems.push(item);
          newItemsCount++;
        }
      }

      // Only store if we have new items
      if (newItems.length > 0) {
        allItems = [...allItems, ...newItems];

        // Store new items in the database
        await db.createEvent({
          type: "modqueue.full",
          subreddit,
          data: {
            items: newItems,
            timestamp: Date.now(),
            batch_after: after,
          },
          new_items_count: newItems.length,
        });
      }

      // Check if we have more items to fetch
      after = modqueueListing.data.after;
      if (!after) break;

      // Optional: Add a small delay to avoid hitting rate limits
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    // Update the cache with the complete set
    if (newItemsCount > 0) {
      cache.set(`modqueue:${subreddit}`, allItems);
    }

    return c.json({
      success: true,
      total_items: allItems.length,
      new_items: newItemsCount,
    });
  } catch (err) {
    console.error(err);
    return c.text("Error fetching full modqueue", 500);
  }
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

    // Invalidate affected subreddit's cache
    // const subreddit = await client.getThingSubreddit(thing);
    // if (subreddit) {
    //   logger.debug("🗑️ Invalidating cache", { subreddit });
    //   cache.delete(`modqueue:${subreddit}`);
    // }

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

    // Invalidate affected subreddit's cache
    // const subreddit = await client.getThingSubreddit(thing);
    // if (subreddit) {
    //   logger.debug("🗑️ Invalidating cache", { subreddit });
    //   cache.delete(`modqueue:${subreddit}`);
    // }

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

// Handle graceful shutdown
function cleanup() {
  logger.info("🛑 Shutting down server...");
  scheduler.stopAll();
  process.exit(0);
}

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);

// Start the server
logger.info("🚀 Starting server...");

export default app;
