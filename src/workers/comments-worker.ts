import { QueueManager } from "../queue";
import redditClient from "../services/reddit-api-client";
import { eq, and, inArray, desc } from "drizzle-orm";
import db from "../db";
import { commentsTable, syncStatusTable } from "../db/schema";
import logger from "../logger";

type InitialSyncJobData = {
  subreddit: string;
};

type UpdateSyncJobData = {
  subreddit: string;
};

// Processor for initial full sync of comments
export const initialSyncProcessor = async (data: InitialSyncJobData) => {
  try {
    const { subreddit } = data;
    logger.info(`Starting initial comments sync for subreddit: ${subreddit}`);

    const syncStatus = await db
      .select()
      .from(syncStatusTable)
      .where(
        and(
          eq(syncStatusTable.subreddit, subreddit),
          eq(syncStatusTable.type, "comments")
        )
      )
      .orderBy(desc(syncStatusTable.created_at))
      .limit(1);

    const lastOffset = syncStatus[0]?.last_offset ?? undefined;
    logger.debug(
      `Last offset for initial comments sync of ${subreddit}: ${lastOffset}`
    );

    const commentsData = await redditClient()
      .subreddit(subreddit)
      .comments({ after: lastOffset, limit: 100 });

    logger.info(
      `Fetched ${commentsData.data.children.length} comments for initial sync of ${subreddit}`
    );

    if (commentsData.data.children.length > 0) {
      const valuesToInsert = commentsData.data.children.map((item) => ({
        subreddit,
        author: item.data.author,
        name: item.data.name,
        type: item.kind,
        raw_data: item,
      }));

      await db
        .insert(commentsTable)
        .values(valuesToInsert)
        .onConflictDoNothing();
      logger.info(
        `Inserted ${valuesToInsert.length} comments for initial sync of ${subreddit}`
      );
    }

    if (commentsData.data.after) {
      await db.insert(syncStatusTable).values({
        subreddit,
        last_offset: commentsData.data.after,
        type: "comments",
      });

      // Queue next page with delay
      await initialSyncQueue.add(
        { subreddit },
        { delay: 1000 } // 1s delay to respect rate limits
      );
    } else {
      // Initial sync complete, set up recurring updates
      logger.info(
        `Initial comments sync completed for ${subreddit}, setting up update scheduler`
      );

      await updateSyncQueue.queue.upsertJobScheduler(
        `comments-update-${subreddit}`,
        { every: 10000 }, // Every 10 seconds
        {
          name: "subreddit-comments-update",
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
    logger.error("Error in comments initialSyncProcessor", {
      error,
      subreddit: data.subreddit,
    });
    throw error;
  }
};

// Processor for regular comment updates
export const updateSyncProcessor = async (data: UpdateSyncJobData) => {
  try {
    const { subreddit } = data;
    logger.debug(`Running comments update sync for subreddit: ${subreddit}`);

    const syncStatus = await db
      .select()
      .from(syncStatusTable)
      .where(
        and(
          eq(syncStatusTable.subreddit, subreddit),
          eq(syncStatusTable.type, "comments")
        )
      )
      .orderBy(desc(syncStatusTable.created_at))
      .limit(1);

    const lastOffset = syncStatus[0]?.last_offset ?? undefined;

    const commentsData = await redditClient()
      .subreddit(subreddit)
      .comments({ after: lastOffset });

    if (commentsData.data.children.length > 0) {
      // Check which comments are actually new
      const names = commentsData.data.children.map((item) => item.data.name);

      const existingItems = await db
        .select({ name: commentsTable.name })
        .from(commentsTable)
        .where(
          and(
            eq(commentsTable.subreddit, subreddit),
            inArray(commentsTable.name, names)
          )
        );

      const existingNames = new Set(existingItems.map((item) => item.name));

      const newItems = commentsData.data.children.filter(
        (item) => !existingNames.has(item.data.name)
      );

      if (newItems.length > 0) {
        logger.info(`Found ${newItems.length} new comments for ${subreddit}`);

        const valuesToInsert = newItems.map((item) => ({
          subreddit,
          author: item.data.author,
          name: item.data.name,
          type: item.kind,
          raw_data: item,
        }));

        await db
          .insert(commentsTable)
          .values(valuesToInsert)
          .onConflictDoNothing();
      } else {
        logger.debug(`No new comments found for ${subreddit}`);
      }
    }

    if (commentsData.data.after) {
      await db.insert(syncStatusTable).values({
        subreddit,
        last_offset: commentsData.data.after,
        type: "comments",
      });

      logger.debug(
        `Created new comments sync status for ${subreddit}, offset: ${commentsData.data.after}`
      );
    }
  } catch (error) {
    logger.error("Error in comments updateSyncProcessor", {
      error,
      subreddit: data.subreddit,
    });
    throw error;
  }
};

// Create two separate queues for comments
export const initialSyncQueue = new QueueManager(
  "comments-initial-sync",
  initialSyncProcessor,
  { maxParallel: 1 }
);

export const updateSyncQueue = new QueueManager(
  "comments-updates",
  updateSyncProcessor,
  { maxParallel: 1 }
);
