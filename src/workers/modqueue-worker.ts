import { QueueManager } from "../queue";
import redditClient from "../services/reddit-api-client";

import { eq } from "drizzle-orm";
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
      await updateSyncQueue.add({ subreddit }, { repeat: { every: 1000 } });
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
      logger.info(
        `Found ${modqueueData.data.children.length} new items for ${subreddit}`
      );

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

      // Update sync status
      await db
        .update(syncStatusTable)
        .set({
          last_offset: modqueueData.data.after,
          last_sync_at: new Date().toISOString(),
        })
        .where(eq(syncStatusTable.subreddit, subreddit));
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
  { maxParallel: 5 } // Can handle multiple update syncs concurrently
);
