import { QueueManager } from "../queue";
import redditClient from "../services/reddit-api-client";

import { eq, and, inArray, desc } from "drizzle-orm";
import db from "../db";
import { modqueueItemsTable, syncStatusTable } from "../db/schema";
import logger from "../logger";

// Types for our different job payloads
type InitialSyncJobData = {
  subreddit: string;
};

type UpdateSyncJobData = {
  subreddit: string;
};

// Processor for initial full sync
export const initialSyncProcessor = async (data: InitialSyncJobData) => {
  try {
    const { subreddit } = data;
    logger.info(`Starting initial sync for subreddit: ${subreddit}`);

    const syncStatus = await db
      .select()
      .from(syncStatusTable)
      .where(eq(syncStatusTable.subreddit, subreddit))
      .orderBy(desc(syncStatusTable.created_at))
      .limit(1);

    const lastOffset = syncStatus[0]?.last_offset ?? undefined;
    logger.debug(`Last offset for initial sync of ${subreddit}: ${lastOffset}`);

    const modqueueData = await redditClient()
      .subreddit(subreddit)
      .mod()
      .modqueue()
      .posts();

    logger.info(
      `Fetched ${modqueueData.data.children.length} items for initial sync of ${subreddit}`
    );

    if (modqueueData.data.children.length > 0) {
      const valuesToInsert = modqueueData.data.children.map((item) => ({
        subreddit,
        author: item.data.author,
        name: item.data.name,
        type: item.kind,
        raw_data: item,
      }));

      await db
        .insert(modqueueItemsTable)
        .values(valuesToInsert)
        .onConflictDoNothing();
      logger.info(
        `Inserted ${valuesToInsert.length} items for initial sync of ${subreddit}`
      );
    }

    if (modqueueData.data.after) {
      await db.insert(syncStatusTable).values({
        subreddit,
        last_offset: modqueueData.data.after,
      });

      // Queue next page with delay
      await initialSyncQueue.add(
        { subreddit },
        { delay: 1000 } // 1s delay to respect rate limits
      );
    } else {
      // Initial sync complete, set up recurring updates
      logger.info(
        `Initial sync completed for ${subreddit}, setting up update scheduler`
      );

      await updateSyncQueue.queue.upsertJobScheduler(
        `update-${subreddit}`,
        { every: 5000 },
        {
          name: "subreddit-update",
          data: { subreddit },
          opts: {
            attempts: 3,
            backoff: {
              type: "exponential",
              delay: 1000,
            },
          },
        }
      );
    }
  } catch (error) {
    logger.error("Error in initialSyncProcessor", {
      error,
      subreddit: data.subreddit,
    });
    throw error;
  }
};

// Processor for regular updates
export const updateSyncProcessor = async (data: UpdateSyncJobData) => {
  try {
    const { subreddit } = data;
    logger.debug(`Running update sync for subreddit: ${subreddit}`);

    // Get most recent sync status
    const syncStatus = await db
      .select()
      .from(syncStatusTable)
      .where(eq(syncStatusTable.subreddit, subreddit))
      .orderBy(desc(syncStatusTable.created_at))
      .limit(1);

    const lastOffset = syncStatus[0]?.last_offset ?? undefined;

    const modqueueData = await redditClient()
      .subreddit(subreddit)
      .mod()
      .modqueue()
      .posts();

    if (modqueueData.data.children.length > 0) {
      // Check which items are actually new
      const names = modqueueData.data.children.map((item) => item.data.name);

      const existingItems = await db
        .select({ name: modqueueItemsTable.name })
        .from(modqueueItemsTable)
        .where(
          and(
            eq(modqueueItemsTable.subreddit, subreddit),
            inArray(modqueueItemsTable.name, names)
          )
        );

      const existingNames = new Set(existingItems.map((item) => item.name));

      const newItems = modqueueData.data.children.filter(
        (item) => !existingNames.has(item.data.name)
      );

      if (newItems.length > 0) {
        logger.info(`Found ${newItems.length} new items for ${subreddit}`);

        const valuesToInsert = newItems.map((item) => ({
          subreddit,
          author: item.data.author,
          name: item.data.name,
          type: item.kind,
          raw_data: item,
        }));

        await db
          .insert(modqueueItemsTable)
          .values(valuesToInsert)
          .onConflictDoNothing();
      } else {
        logger.debug(`No new items found for ${subreddit}`);
      }
    }

    if (modqueueData.data.after) {
      await db.insert(syncStatusTable).values({
        subreddit,
        last_offset: modqueueData.data.after,
      });

      logger.debug(
        `Created new sync status for ${subreddit}, offset: ${modqueueData.data.after}`
      );
    }
  } catch (error) {
    logger.error("Error in updateSyncProcessor", {
      error,
      subreddit: data.subreddit,
    });
    throw error;
  }
};

// Create two separate queues
export const initialSyncQueue = new QueueManager(
  "modqueue-initial-sync",
  initialSyncProcessor,
  { maxParallel: 1 } // Process one initial sync at a time
);

export const updateSyncQueue = new QueueManager(
  "modqueue-updates",
  updateSyncProcessor,
  { maxParallel: 1 } // Can handle multiple update syncs concurrently
);
