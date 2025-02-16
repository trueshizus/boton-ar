import { Queue, Worker, QueueEvents } from "bullmq";
import logger from "./logger";

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
}

const DEFAULT_OPTIONS: QueueOptions = {
  pollInterval: 1000,
  maxParallel: 1,
  maxSize: 1000,
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379"),
};

export class QueueManager<T = any> {
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
      return await this.processor(job.data);
    } catch (error) {
      logger.error("Worker error", { error, jobId: job.id });
      throw error;
    }
  }

  async add(data: T, options: JobOptions = {}) {
    const job = await this.queue.add("job", data, {
      priority: options.priority,
      delay: options.delay,
      attempts: options.attempts,
    });
    return job.id;
  }

  async remove(jobId: string) {
    const job = await this.queue.getJob(jobId);
    if (job) {
      return job.remove();
    }
    return false;
  }

  async schedule(jobId: string, delay: number) {
    const job = await this.queue.getJob(jobId);
    if (job) {
      return job.moveToDelayed(Date.now() + delay);
    }
    return false;
  }

  async interrupt(jobId: string) {
    const job = await this.queue.getJob(jobId);
    if (job) {
      return job.moveToFailed({ message: "Job interrupted" });
    }
    return false;
  }

  async getStatus(jobId: string) {
    const job = await this.queue.getJob(jobId);
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
  }

  async waitForCompletion(jobId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.queueEvents.once("completed", ({ jobId: completedJobId }) => {
        if (completedJobId === jobId) resolve();
      });
      this.queueEvents.once("failed", ({ jobId: failedJobId }) => {
        if (failedJobId === jobId) resolve();
      });
    });
  }

  async clean(grace: number = 24 * 60 * 60 * 1000) {
    await this.queue.clean(grace, 20, "completed");
    await this.queue.clean(grace, 20, "failed");
    return Promise.resolve();
  }

  async pause() {
    await this.worker.pause();
    return Promise.resolve();
  }

  async resume() {
    await this.worker.resume();
    return Promise.resolve();
  }

  async close() {
    await this.worker.close();
    await this.queue.close();
    await this.queueEvents.close();
    return Promise.resolve();
  }
}
