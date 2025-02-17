import { Queue, Worker, QueueEvents } from "bullmq";
import logger from "./logger";

const JOB_ID_ERROR = -1;

interface QueueOptions {
  pollInterval?: number;
  maxParallel?: number;
  maxSize?: number;
  host?: string;
  port?: number;
}

interface JobOptions {
  priority?: number;
  delay?: number;
  attempts?: number;
  repeat?: {
    every: number;
  };
}

const DEFAULT_OPTIONS: QueueOptions = {
  pollInterval: 1000,
  maxParallel: 1,
  maxSize: 1000,
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379"),
};

export class QueueManager<T> {
  private queue: Queue;
  private worker: Worker;
  private queueEvents: QueueEvents;
  private processor: (data: T) => Promise<any>;

  constructor(
    queueName: string,
    processor: (data: T) => Promise<any>,
    options: QueueOptions = {}
  ) {
    const config = { ...DEFAULT_OPTIONS, ...options };
    const connection = {
      host: config.host,
      port: config.port,
    };

    this.processor = processor;
    this.queue = new Queue(queueName, {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: config.pollInterval,
        },
      },
    });

    this.queueEvents = new QueueEvents(queueName, { connection });
    this.setupEventListeners();

    this.worker = new Worker(queueName, this.processJob.bind(this), {
      connection,
      concurrency: config.maxParallel,
    });
    logger.info(`Queue "${queueName}" initialized.`, {
      host: config.host,
      port: config.port,
      maxParallel: config.maxParallel,
      pollInterval: config.pollInterval,
    });
  }

  private setupEventListeners() {
    this.queueEvents.on("completed", ({ jobId, returnvalue }) => {
      logger.info(`Job completed: ${jobId}`, returnvalue);
    });

    this.queueEvents.on("failed", ({ jobId, failedReason }) => {
      logger.error(`Job failed: ${jobId}`, { reason: failedReason });
    });
  }

  private async processJob(job: any) {
    try {
      logger.debug(`Processing job: ${job.id}`, { data: job.data });
      return await this.processor(job.data);
    } catch (error) {
      logger.error("Worker error", { error, jobId: job.id });
      throw error;
    }
  }

  async add(data: T, options: JobOptions = {}) {
    const job = await this.queue.add("job", data, options);
    logger.info(`Job added to queue: ${job.id}`, { data, options });
    return job.id || JOB_ID_ERROR;
  }

  async remove(jobId: string) {
    const job = await this.queue.getJob(jobId);
    if (job) {
      logger.info(`Removing job: ${jobId}`);
      return job.remove();
    }
    logger.warn(`Job not found for removal: ${jobId}`);
    return false;
  }

  async schedule(jobId: string, delay: number) {
    const job = await this.queue.getJob(jobId);
    if (job) {
      logger.info(`Scheduling job: ${jobId} for ${delay}ms`);
      return job.moveToDelayed(Date.now() + delay);
    }
    logger.warn(`Job not found for scheduling: ${jobId}`);
    return false;
  }

  async interrupt(jobId: string) {
    const job = await this.queue.getJob(jobId);
    if (job) {
      logger.warn(`Interrupting job: ${jobId}`);
      return job.moveToFailed({ message: "Job interrupted" });
    }
    logger.warn(`Job not found for interruption: ${jobId}`);
    return false;
  }

  async getStatus(jobId: string) {
    const job = await this.queue.getJob(jobId);
    if (!job) return { status: "not_found" };

    const state = await job.getState();
    const progress = job.progress();

    logger.debug(`Job status: ${jobId}`, {
      status: state,
      progress,
      attempts: job.attemptsMade,
    });
    return {
      id: job.id,
      status: state,
      progress,
      attempts: job.attemptsMade,
      timestamp: job.timestamp,
    };
  }

  async waitForCompletion(jobId: string): Promise<void> {
    logger.debug(`Waiting for completion of job: ${jobId}`);
    return new Promise((resolve, reject) => {
      this.queueEvents.once("completed", ({ jobId: completedJobId }) => {
        if (completedJobId === jobId) {
          logger.debug(`Job completed while waiting: ${jobId}`);
          resolve();
        }
      });
      this.queueEvents.once("failed", ({ jobId: failedJobId }) => {
        if (failedJobId === jobId) {
          logger.debug(`Job failed while waiting: ${jobId}`);
          resolve(); // Resolve even on failure, as we're waiting for *completion* (either success or failure)
        }
      });
    });
  }

  async clean(grace: number = 24 * 60 * 60 * 1000) {
    logger.info(`Cleaning queue with grace period: ${grace}ms`);
    await this.queue.clean(grace, 20, "completed");
    await this.queue.clean(grace, 20, "failed");
    return Promise.resolve();
  }

  async pause() {
    logger.info("Pausing worker");
    await this.worker.pause();
    return Promise.resolve();
  }

  async resume() {
    logger.info("Resuming worker");
    await this.worker.resume();
    return Promise.resolve();
  }

  async close() {
    logger.info("Closing queue, worker, and queue events.");
    await this.worker.close();
    await this.queue.close();
    await this.queueEvents.close();
    return Promise.resolve();
  }

  async getJobs() {
    try {
      // Get all waiting and active jobs
      const waitingJobs = await this.queue.getWaiting();
      const activeJobs = await this.queue.getActive();
      const delayedJobs = await this.queue.getDelayed();

      // Also get any recurring jobs
      const repeatableJobs = await this.queue.getRepeatableJobs();

      // Remove any repeatable jobs from the list
      await Promise.all(
        repeatableJobs.map((job) => this.queue.removeRepeatableByKey(job.key))
      );

      return [...waitingJobs, ...activeJobs, ...delayedJobs];
    } catch (error) {
      logger.error("Error getting jobs", { error });
      return [];
    }
  }

  async removeJob(jobId: string) {
    try {
      const job = await this.queue.getJob(jobId);
      if (job) {
        await job.remove();
        logger.debug(`Removed job ${jobId}`);
        return true;
      }
      return false;
    } catch (error) {
      logger.error("Error removing job", { error, jobId });
      return false;
    }
  }
}
