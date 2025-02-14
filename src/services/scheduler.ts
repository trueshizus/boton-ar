import { pollModqueue } from "../workers/modqueue";
import logger from "../logger";

export class Scheduler {
  private static instance: Scheduler;
  private intervals: Map<string, number>;
  private readonly DEFAULT_INTERVAL = 60 * 1000; // 1 minute

  private constructor() {
    this.intervals = new Map();
    logger.info("🎯 Scheduler initialized");
  }

  static getInstance(): Scheduler {
    if (!Scheduler.instance) {
      Scheduler.instance = new Scheduler();
    }
    return Scheduler.instance;
  }

  startModqueuePolling(
    subreddit: string,
    interval: number = this.DEFAULT_INTERVAL
  ) {
    const key = `modqueue:${subreddit}`;

    // Don't start a new interval if one already exists for this subreddit
    if (this.intervals.has(key)) {
      logger.info("⏭️ Modqueue polling already active", { subreddit });
      return;
    }

    logger.info("▶️ Starting modqueue polling", { subreddit, interval });

    // Immediately poll once before starting the interval
    pollModqueue(subreddit).catch((error) => {
      logger.error("❌ Initial modqueue polling failed", {
        subreddit,
        error: error.message,
      });
    });

    // Set up the interval for subsequent polls
    const intervalId = setInterval(async () => {
      try {
        logger.debug("🔄 Running scheduled modqueue poll", { subreddit });
        await pollModqueue(subreddit);
      } catch (error) {
        logger.error("❌ Scheduled modqueue polling failed", {
          subreddit,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }, interval);

    this.intervals.set(key, interval);
    logger.info("✅ Modqueue polling started successfully", {
      subreddit,
      totalActive: this.intervals.size,
    });
  }

  stopModqueuePolling(subreddit: string) {
    const key = `modqueue:${subreddit}`;
    const intervalId = this.intervals.get(key);

    if (intervalId) {
      clearInterval(intervalId);
      this.intervals.delete(key);
      logger.info("⏹️ Stopped modqueue polling", {
        subreddit,
        remainingActive: this.intervals.size,
      });
    } else {
      logger.warn("⚠️ Attempted to stop non-existent modqueue polling", {
        subreddit,
      });
    }
  }

  stopAll() {
    const count = this.intervals.size;
    for (const [key, intervalId] of this.intervals) {
      clearInterval(intervalId);
      this.intervals.delete(key);
    }
    logger.info("🛑 Stopped all modqueue polling intervals", {
      stoppedCount: count,
    });
  }

  getStatus(): { [key: string]: boolean } {
    const status: { [key: string]: boolean } = {};
    for (const [key] of this.intervals) {
      status[key] = true;
    }
    logger.debug("📊 Current polling status", { status });
    return status;
  }
}
