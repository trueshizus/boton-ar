import { Hono } from "hono";
import db from "../db";
import { modqueueTable, trackedSubredditsTable } from "../db/schema";
import { eq, sql } from "drizzle-orm";
import logger from "../logger";
import client from "../services/reddit-api-client";
import { QueueManager } from "../queue";

const app = new Hono();

// Define the seed job type
interface SeedJob {
  subreddit: string;
  timestamp: string;
}

// Create a queue instance for seeding
const seedQueue = new QueueManager<SeedJob>(
  "subreddit-seed",
  async (data) => {
    const { subreddit } = data;
    let after: string | undefined = undefined;
    let totalProcessed = 0;

    while (true) {
      const modqueueListing = await client.subreddit(subreddit).modqueue({
        after,
      });
      const items = modqueueListing.data.children;

      if (items.length === 0) break;

      await db.insert(modqueueTable).values(
        items.map((item) => ({
          subreddit,
          thingId: item.data.name,
          data: item,
        }))
      );

      totalProcessed += items.length;

      if (items.length < 100 || !modqueueListing.data.after) break;
      after = modqueueListing.data.after;
    }

    return { totalProcessed };
  },
  { maxParallel: 2 }
);

app.get("/", async (c) => {
  const result = await db.select().from(trackedSubredditsTable);
  return c.json(result);
});

app.post("/", async (c) => {
  try {
    const { subreddit } = await c.req.json();

    if (!subreddit) {
      return c.json(
        { status: "error", message: "Subreddit name is required" },
        400
      );
    }

    // Check if subreddit already exists
    const existing = await db
      .select()
      .from(trackedSubredditsTable)
      .where(eq(trackedSubredditsTable.subreddit, subreddit))
      .limit(1);

    if (existing.length > 0) {
      return c.json(
        {
          status: "error",
          message: "Subreddit is already being tracked",
        },
        409 // Conflict status code
      );
    }

    const result = await db
      .insert(trackedSubredditsTable)
      .values({ subreddit })
      .returning();

    return c.json(
      {
        status: "success",
        result,
      },
      201 // Created status code
    );
  } catch (err) {
    return c.json(
      {
        status: "error",
        message: "Failed to add subreddit",
      },
      500
    );
  }
});

app.get("/:subreddit", async (c) => {
  const subreddit = c.req.param("subreddit");
  const existing = await db
    .select()
    .from(trackedSubredditsTable)
    .where(eq(trackedSubredditsTable.subreddit, subreddit))
    .limit(1);

  if (existing.length === 0) {
    return c.notFound();
  }

  return c.json(existing);
});

app.get("/:subreddit/modqueue", async (c) => {
  const subreddit = c.req.param("subreddit");
  const { limit = "100", offset = "0" } = c.req.query();

  const existing = await db
    .select()
    .from(trackedSubredditsTable)
    .where(eq(trackedSubredditsTable.subreddit, subreddit))
    .limit(1);

  if (existing.length === 0) {
    return c.notFound();
  }

  const modqueue = await db
    .select()
    .from(modqueueTable)
    .where(eq(modqueueTable.subreddit, subreddit))
    .limit(parseInt(limit))
    .offset(parseInt(offset));

  // Get total count for pagination info
  const [{ count }] = await db
    .select({ count: sql`count(*)` })
    .from(modqueueTable)
    .where(eq(modqueueTable.subreddit, subreddit));

  return c.json({
    items: modqueue,
    pagination: {
      total: Number(count),
      offset: parseInt(offset),
      limit: parseInt(limit),
    },
  });
});

app.get("/:subreddit/modqueue/current", async (c) => {
  try {
    const subreddit = c.req.param("subreddit");
    // Check if subreddit is being tracked
    const existing = await db
      .select()
      .from(trackedSubredditsTable)
      .where(eq(trackedSubredditsTable.subreddit, subreddit))
      .limit(1);

    if (existing.length === 0) {
      return c.notFound();
    }

    const { offset } = c.req.query();
    logger.info(
      `🔍 Fetching modqueue for ${subreddit} with offset ${offset || "empty"}`
    );

    const subredditClient = client.subreddit(subreddit);
    const modqueueListing = await subredditClient.modqueue({
      after: offset,
    });

    return c.json(modqueueListing);
  } catch (err) {
    logger.error("❌ Error fetching modqueue", {
      subreddit: c.req.param("subreddit"),
      error: err,
    });
    return c.json({ error: "Error fetching modqueue" }, 500);
  }
});

app.post("/:subreddit/modqueue/seed", async (c) => {
  const { subreddit } = c.req.param();
  const existing = await db
    .select()
    .from(trackedSubredditsTable)
    .where(eq(trackedSubredditsTable.subreddit, subreddit))
    .limit(1);

  if (existing.length === 0) {
    return c.json({ error: "Subreddit is not being tracked" }, 404);
  }

  logger.info(`🌱 Scheduling modqueue seed: ${subreddit}`);

  try {
    const jobId = await seedQueue.add(
      {
        subreddit,
        timestamp: new Date().toISOString(),
      },
      {
        priority: 3,
        attempts: 3,
      }
    );

    return c.json({
      message: "Seed job scheduled",
      jobId,
      status: "pending",
    });
  } catch (err) {
    logger.error(`❌ Error scheduling seed job: ${subreddit}`, {
      error: err,
    });
    return c.json({ error: "Error scheduling seed job" }, 500);
  }
});

app.get("/:subreddit/modqueue/seed/status/:jobId", async (c) => {
  const { jobId } = c.req.param();
  const status = await seedQueue.getStatus(jobId);
  return c.json(status);
});

// Cleanup when the application shuts down
process.on("SIGTERM", async () => {
  await seedQueue.close();
});

export default app;
