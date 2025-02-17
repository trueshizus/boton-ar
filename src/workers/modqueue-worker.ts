import { QueueManager } from "../queue";
import redditClient from "../services/reddit-api-client";

import { eq, and, inArray } from "drizzle-orm";
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
      .where(eq(syncStatusTable.subreddit, subreddit));

    const lastOffset = syncStatus[0]?.last_offset ?? undefined;
    logger.debug(`Last offset for initial sync of ${subreddit}: ${lastOffset}`);

    const modqueueData = await redditClient.subreddit(subreddit).modqueue({
      after: lastOffset,
      limit: 100,
    });

    logger.info(
      `Fetched ${modqueueData.data.children.length} items for initial sync of ${subreddit}`
    );

    if (modqueueData.data.children.length > 0) {
      const valuesToInsert = modqueueData.data.children.map((item) => ({
        subreddit,
        author: item.data.author,
        permalink: item.data.permalink,
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
      // Update or insert sync status
      if (syncStatus.length > 0) {
        await db
          .update(syncStatusTable)
          .set({
            last_offset: modqueueData.data.after,
            last_sync_at: new Date().toISOString(),
          })
          .where(eq(syncStatusTable.subreddit, subreddit));
      } else {
        await db.insert(syncStatusTable).values({
          subreddit: subreddit,
          last_offset: modqueueData.data.after,
          last_sync_at: new Date().toISOString(),
        });
      }

      // Queue next page with delay
      await initialSyncQueue.add(
        { subreddit },
        { delay: 1000 } // 1s delay to respect rate limits
      );
    } else {
      // Initial sync complete, set up recurring updates
      logger.info(
        `Initial sync completed for ${subreddit}, setting up recurring updates`
      );
      await updateSyncQueue.add({ subreddit }, { repeat: { every: 5000 } });
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

    const syncStatus = await db
      .select()
      .from(syncStatusTable)
      .where(eq(syncStatusTable.subreddit, subreddit));

    const lastOffset = syncStatus[0]?.last_offset ?? undefined;

    const modqueueData = await redditClient.subreddit(subreddit).modqueue({
      after: lastOffset,
      limit: 100,
    });

    if (modqueueData.data.children.length > 0) {
      // Check which items are actually new by looking up their permalinks
      const permalinks = modqueueData.data.children.map(
        (item) => item.data.permalink
      );

      const existingItems = await db
        .select({ permalink: modqueueItemsTable.permalink })
        .from(modqueueItemsTable)
        .where(
          and(
            eq(modqueueItemsTable.subreddit, subreddit),
            inArray(modqueueItemsTable.permalink, permalinks)
          )
        );

      const existingPermalinks = new Set(
        existingItems.map((item) => item.permalink)
      );

      const newItems = modqueueData.data.children.filter(
        (item) => !existingPermalinks.has(item.data.permalink)
      );

      if (newItems.length > 0) {
        logger.info(`Found ${newItems.length} new items for ${subreddit}`);

        const valuesToInsert = newItems.map((item) => ({
          subreddit,
          author: item.data.author,
          permalink: item.data.permalink,
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

    // Always update the last_offset and last_sync_at
    // This helps maintain the pagination position even when no new items are found
    if (modqueueData.data.after) {
      await db
        .update(syncStatusTable)
        .set({
          last_offset: modqueueData.data.after,
          last_sync_at: new Date().toISOString(),
        })
        .where(eq(syncStatusTable.subreddit, subreddit));

      logger.debug(
        `Updated sync status for ${subreddit}, new offset: ${modqueueData.data.after}`
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
