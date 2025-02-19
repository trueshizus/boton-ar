import { QueueManager } from "../queue";
import redditClient from "../services/reddit-api-client";

import { eq, and, inArray, desc } from "drizzle-orm";
import db from "../db";
import { modqueueItemsTable, syncStatusTable } from "../db/schema";
import logger from "../logger";

// Types for our different job payloads
type ModqueueSyncJobData = {
  subreddit: string;
  after?: string;
};

// Combined processor for both initial and update syncs
export const modqueueSyncProcessor = async (data: ModqueueSyncJobData) => {
  try {
    const { subreddit, after } = data;
    logger.info(`Running sync for subreddit: ${subreddit}`);

    const modqueueData = await redditClient()
      .subreddit(subreddit)
      .mod()
      .modqueue()
      .posts({ after, limit: 100 });

    logger.info(
      `Fetched ${modqueueData.data.children.length} items for ${subreddit}`
    );

    if (modqueueData.data.children.length > 0) {
      const valuesToInsert = modqueueData.data.children.map((item) => ({
        subreddit,
        author: item.data.author,
        name: item.data.name,
        type: item.kind,
        raw_data: item,
      }));

      const result = await db
        .insert(modqueueItemsTable)
        .values(valuesToInsert)
        .onConflictDoNothing()
        .returning({ insertedId: modqueueItemsTable.id });

      const insertedCount = result.length;
      const allItemsWereNew = insertedCount === valuesToInsert.length;

      logger.info(
        `Inserted ${insertedCount}/${valuesToInsert.length} items for ${subreddit}`
      );

      if (modqueueData.data.after) {
        // Queue next page with adaptive delay
        const delay = allItemsWereNew ? 1000 : 20000; // 1s or 20s delay
        await modqueueSyncQueue.add(
          { subreddit, after: modqueueData.data.after },
          { delay }
        );

        logger.debug(
          `Queued next sync for ${subreddit} with ${delay}ms delay (${
            allItemsWereNew ? "all new" : "some existing"
          } items)`
        );
      }

      // Update sync status
      await db.insert(syncStatusTable).values({
        subreddit,
        last_offset: modqueueData.data.after,
        type: "modqueue",
      });
    }
  } catch (error) {
    logger.error("Error in modqueueSyncProcessor", {
      error,
      subreddit: data.subreddit,
    });
    throw error;
  }
};

// Single queue for all modqueue syncs
export const modqueueSyncQueue = new QueueManager(
  "modqueue-sync",
  modqueueSyncProcessor,
  { maxParallel: 1 } // Process one sync at a time
);
