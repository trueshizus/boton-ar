import { QueueManager } from "../queue";
import redditClient from "../services/reddit-api-client";
import { eq, and, inArray, desc } from "drizzle-orm";
import db from "../db";
import { commentsTable, syncStatusTable } from "../db/schema";
import logger from "../logger";

type CommentsSyncJobData = {
  subreddit: string;
  after?: string;
};

// Combined processor for both initial and update syncs
export const commentsSyncProcessor = async (data: CommentsSyncJobData) => {
  try {
    const { subreddit, after } = data;
    logger.info(`Running comments sync for subreddit: ${subreddit}`);

    const commentsData = await redditClient()
      .subreddit(subreddit)
      .comments({ after, limit: 100 });

    logger.info(
      `Fetched ${commentsData.data.children.length} comments for ${subreddit}`
    );

    if (commentsData.data.children.length > 0) {
      const valuesToInsert = commentsData.data.children.map((item) => ({
        subreddit,
        author: item.data.author,
        name: item.data.name,
        type: item.kind,
        raw_data: item,
      }));

      const result = await db
        .insert(commentsTable)
        .values(valuesToInsert)
        .onConflictDoNothing()
        .returning({ insertedId: commentsTable.id });

      const insertedCount = result.length;
      const allItemsWereNew = insertedCount === valuesToInsert.length;

      logger.info(
        `Inserted ${insertedCount}/${valuesToInsert.length} comments for ${subreddit}`
      );

      if (commentsData.data.after) {
        // Queue next page with adaptive delay
        const delay = allItemsWereNew ? 1000 : 20000; // 1s or 20s delay
        await commentsSyncQueue.add(
          { subreddit, after: commentsData.data.after },
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
        last_offset: commentsData.data.after,
        type: "comments",
      });
    }
  } catch (error) {
    logger.error("Error in commentsSyncProcessor", {
      error,
      subreddit: data.subreddit,
    });
    throw error;
  }
};

// Single queue for all comment syncs
export const commentsSyncQueue = new QueueManager(
  "comments-sync",
  commentsSyncProcessor,
  { maxParallel: 1 } // Process one sync at a time
);
