import { Queue, Worker, QueueEvents } from "bullmq";
import logger from "./logger";
import client from "./services/reddit-api-client";
import db from "./db";
import { modqueueTable } from "./db/schema";
const connection = {
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379"),
};

// Queue for modqueue seeding
export const seedQueue = new Queue("modqueue-seed", {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 1000,
    },
  },
});

const queueEvents = new QueueEvents("modqueue-seed", { connection });

queueEvents.on("completed", ({ jobId, returnvalue }) => {
  logger.info(`Job completed: ${jobId}, ${returnvalue}`);
});

queueEvents.on("failed", ({ jobId, failedReason }) => {
  logger.error(`Job failed: ${jobId}, ${failedReason}`);
});

const worker = new Worker(
  "modqueue-seed",
  async (job) => {
    const { subreddit } = job.data;
    let after: string | undefined = undefined;
    let totalProcessed = 0;

    try {
      while (true) {
        await job.updateProgress(totalProcessed);

        const modqueueListing = await client
          .subreddit(subreddit)
          .modqueue(after);
        const items = modqueueListing.data.children;

        if (items.length === 0) break;

        await db.insert(modqueueTable).values(
          items.map((item) => ({
            subreddit,
            thingId: item.data.name,
            data: item,
          }))
        );

        totalProcessed += items.length;

        // Update progress again
        await job.updateProgress(totalProcessed);

        if (items.length < 100 || !modqueueListing.data.after) break;
        after = modqueueListing.data.after;
      }

      return { totalProcessed };
    } catch (error) {
      logger.error("Worker error", { error });
      throw error;
    }
  },
  { connection }
);

export const addSeedJob = async (subreddit: string) => {
  const job = await seedQueue.add("seed", {
    subreddit,
    timestamp: new Date().toISOString(),
  });
  return job.id;
};

export const getSeedJobStatus = async (jobId: string) => {
  const job = await seedQueue.getJob(jobId);
  if (!job) return { status: "not_found" };

  const state = await job.getState();
  const progress = await job.progress();

  return {
    id: job.id,
    status: state,
    progress,
    attempts: job.attemptsMade,
    timestamp: job.timestamp,
  };
};
