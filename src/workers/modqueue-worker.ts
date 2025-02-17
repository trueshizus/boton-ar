import { QueueManager } from "../queue";
import redditClient from "../services/reddit-api-client";

import { eq } from "drizzle-orm";
import db from "../db";
import { modqueueItemsTable, syncStatusTable } from "../db/schema";
import logger from "../logger";

export const modqueueProcessor = async (data: { subreddit: string }) => {
  try {
    const { subreddit } = data;

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
      const valuesToInsert = modqueueData.data.children.map((item) => ({
        subreddit,
        author: item.data.author,
        permalink: item.data.permalink,
        created_utc: new Date(item.data.created_utc * 1000),
        type: item.kind,
        raw_data: item,
      }));

      await db
        .insert(modqueueItemsTable)
        .values(valuesToInsert)
        .onConflictDoNothing();
    }

    if (modqueueData.data.after) {
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
    } else if (!lastOffset) {
      await modqueueQueue.add({ subreddit }, { repeat: { every: 10000 } });
    }
  } catch (error) {
    logger.error("Error in modqueueProcessor", { error, data });
    throw error;
  }
};

export const modqueueQueue = new QueueManager("modqueue", modqueueProcessor);
