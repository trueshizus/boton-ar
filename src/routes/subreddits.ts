import { Hono } from "hono";
import db from "../db";
import { trackedSubredditsTable } from "../db/schema";
import { eq } from "drizzle-orm";
import logger from "../logger";
import client from "../services/reddit-api-client";
const app = new Hono();

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

// app.post("/api/subreddit/:subreddit/modqueue/seed", async (c) => {
//   const { subreddit } = c.req.param();
//   logger.info("🌱 Scheduling modqueue seed", { subreddit });

//   try {
//     const jobId = await addSeedJob(subreddit);

//     return c.json({
//       message: "Seed job scheduled",
//       jobId,
//       status: "pending",
//     });
//   } catch (err) {
//     logger.error("❌ Error scheduling seed job", {
//       subreddit,
//       error: err,
//     });
//     return c.json({ error: "Error scheduling seed job" }, 500);
//   }
// });

// app.get("/api/subreddit/:subreddit/modqueue/seed/status/:jobId", async (c) => {
//   const { jobId } = c.req.param();
//   const status = await getSeedJobStatus(jobId);

//   return c.json(status);
// });

export default app;
