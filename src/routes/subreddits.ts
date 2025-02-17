import { and, eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import db from "../db";
import {
  modqueueItemsTable,
  syncStatusTable,
  trackedSubredditsTable,
} from "../db/schema";
import logger from "../logger";
import client from "../services/reddit-api-client";

import { initialSyncQueue, updateSyncQueue } from "../workers/modqueue-worker";

const app = new Hono();

app.use("/:subreddit/*", async (c, next) => {
  const subreddit = c.req.param("subreddit");

  const existing = await db
    .select()
    .from(trackedSubredditsTable)
    .where(
      and(
        eq(trackedSubredditsTable.subreddit, subreddit),
        eq(trackedSubredditsTable.is_active, true)
      )
    )
    .limit(1);

  if (existing.length === 0) {
    return c.notFound();
  }
  await next();
});

app.get("/", async (c) => {
  const result = await db.select().from(trackedSubredditsTable);
  return c.json(result);
});

app.post("/", async (c) => {
  try {
    const { subreddit } = await c.req.json<{ subreddit: string }>();

    if (!subreddit) {
      return c.json(
        { status: "error", message: "Subreddit name is required" },
        400
      );
    }

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
        409
      );
    }

    const result = await db
      .insert(trackedSubredditsTable)
      .values({ subreddit })
      .returning();

    // Add to initial sync queue
    await initialSyncQueue.add({ subreddit });

    logger.info(`Added new subreddit ${subreddit} for initial sync`);

    return c.json(
      {
        status: "success",
        result,
      },
      201
    );
  } catch (err) {
    logger.error("Failed to add subreddit", { error: err });
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
  const subredditData = await db
    .select()
    .from(trackedSubredditsTable)
    .where(eq(trackedSubredditsTable.subreddit, subreddit));

  return c.json(subredditData);
});

app.delete("/", async (c) => {
  const { subreddit } = await c.req.json<{ subreddit: string }>();

  if (!subreddit) {
    return c.json(
      { status: "error", message: "Subreddit name is required" },
      400
    );
  }

  try {
    await db.transaction(async (tx) => {
      // First delete all modqueue items
      await tx
        .delete(modqueueItemsTable)
        .where(eq(modqueueItemsTable.subreddit, subreddit));

      // Then delete sync status
      await tx
        .delete(syncStatusTable)
        .where(eq(syncStatusTable.subreddit, subreddit));

      // Finally delete the subreddit tracking entry
      const deletedSubreddit = await tx
        .delete(trackedSubredditsTable)
        .where(eq(trackedSubredditsTable.subreddit, subreddit))
        .returning();

      if (deletedSubreddit.length === 0) {
        throw new Error("Subreddit not found");
      }
    });

    logger.info(`Deleted subreddit and all related data: ${subreddit}`);

    return c.json({
      status: "success",
      message: "Subreddit and all related data deleted",
    });
  } catch (err) {
    logger.error("Failed to delete subreddit", { error: err, subreddit });

    if (err instanceof Error && err.message === "Subreddit not found") {
      return c.json(
        {
          status: "error",
          message: "Subreddit not found",
        },
        404
      );
    }

    return c.json(
      {
        status: "error",
        message: "Failed to delete subreddit",
      },
      500
    );
  }
});

app.get("/:subreddit/modqueue", async (c) => {
  const subreddit = c.req.param("subreddit");
  const { limit = "100", offset = "0" } = c.req.query();

  const modqueue = await db
    .select()
    .from(modqueueItemsTable)
    .where(eq(modqueueItemsTable.subreddit, subreddit))
    .limit(parseInt(limit))
    .offset(parseInt(offset));

  const [{ count }] = await db
    .select({ count: sql`count(*)` })
    .from(modqueueItemsTable)
    .where(eq(modqueueItemsTable.subreddit, subreddit));

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

process.on("SIGTERM", async () => {
  await initialSyncQueue.close();
  await updateSyncQueue.close();
});

export default app;
