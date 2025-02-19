import db from "../db";
import { postsTable, syncStatusTable } from "../db/schema";
import logger from "../logger";
import { QueueManager } from "../queue";
import redditClient from "../services/reddit-api-client";

type PostsSyncJobData = {
  subreddit: string;
  after?: string;
};

export const postsSyncProcessor = async (data: PostsSyncJobData) => {
  try {
    const { subreddit, after } = data;
    logger.info(`Running posts sync for subreddit: ${subreddit}`);

    const postsData = await redditClient()
      .subreddit(subreddit)
      .queue("main")
      .posts({ after, limit: 100 });

    logger.info(
      `Fetched ${postsData.data.children.length} posts for ${subreddit}`
    );

    if (postsData.data.children.length > 0) {
      const valuesToInsert = postsData.data.children.map((item) => ({
        subreddit,
        author: item.data.author,
        name: item.data.name,
        type: item.kind,
        raw_data: item,
      }));

      const result = await db
        .insert(postsTable)
        .values(valuesToInsert)
        .onConflictDoNothing()
        .returning({ insertedId: postsTable.id });

      const insertedCount = result.length;
      const allItemsWereNew = insertedCount === valuesToInsert.length;

      logger.info(
        `Inserted ${insertedCount}/${valuesToInsert.length} posts for ${subreddit}`
      );

      if (postsData.data.after) {
        // Queue next page with adaptive delay
        const delay = allItemsWereNew ? 1000 : 20000; // 1s or 20s delay
        await postsSyncQueue.add(
          { subreddit, after: postsData.data.after },
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
        last_offset: postsData.data.after,
        type: "posts",
      });
    }
  } catch (error) {
    logger.error("Error in postsSyncProcessor", {
      error,
      subreddit: data.subreddit,
    });
    throw error;
  }
};

export const postsSyncQueue = new QueueManager(
  "posts-sync",
  postsSyncProcessor,
  { maxParallel: 1 }
);
