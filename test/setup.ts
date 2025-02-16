import { afterAll, beforeAll, beforeEach, mock } from "bun:test";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import db from "../src/db";
import { trackedSubredditsTable } from "../src/db/schema";
globalThis.$ADZE_ENV = "test";

beforeAll(() => {
  migrate(db, { migrationsFolder: "./drizzle" });
});

beforeEach(async () => {
  // Use Drizzle ORM for consistency
  await db.delete(trackedSubredditsTable);

  // Clean up queue state between tests
  globalMockQueue.clean();
});

afterAll(() => {
  db.$client.close();
});

// Mock classes definition (moved from redis.ts)
class MockQueue {
  private jobs: Map<string, any> = new Map();
  private jobCounter: number = 0;
  private processor: Function | null = null;
  private events: MockQueueEvents;

  constructor() {
    this.events = new MockQueueEvents("", {});
  }

  async add(name: string, data: any, options: any = {}) {
    const id = (++this.jobCounter).toString();
    const job = {
      id,
      data,
      options,
      timestamp: Date.now(),
      attemptsMade: 0,
      state: "waiting",
      _progress: 0,
      getState: async function () {
        return this.state;
      },
      progress: async function () {
        return this._progress;
      },
      remove: async () => {
        this.jobs.delete(id);
        return true;
      },
      moveToDelayed: async () => {
        job.state = "delayed";
        return true;
      },
      moveToFailed: async () => {
        job.state = "failed";
        job.attemptsMade++;
        return true;
      },
    };
    this.jobs.set(id, job);

    // Simulate job processing
    if (this.processor) {
      // Use Promise instead of setTimeout for better test control
      Promise.resolve().then(async () => {
        try {
          await this.processor!(job);
          job.state = "completed";
          this.events.emit("completed", { jobId: job.id });
        } catch (error) {
          job.state = "failed";
          job.attemptsMade++;
          this.events.emit("failed", {
            jobId: job.id,
            failedReason:
              error instanceof Error ? error.message : String(error),
          });
        }
      });
    }

    return job;
  }

  setProcessor(processor: Function) {
    this.processor = processor;
  }

  async getJob(id: string) {
    return this.jobs.get(id) || null;
  }

  async clean() {
    this.jobs.clear();
    return Promise.resolve(undefined);
  }

  async close() {
    this.jobs.clear();
    return Promise.resolve(undefined);
  }

  getEvents() {
    return this.events;
  }
}

class MockWorker {
  constructor(queueName: string, processor: Function, options: any = {}) {
    globalMockQueue.setProcessor(processor);
  }

  async pause() {
    return Promise.resolve(undefined);
  }

  async resume() {
    return Promise.resolve(undefined);
  }

  async close() {
    return Promise.resolve(undefined);
  }
}

class MockQueueEvents {
  private listeners: Map<string, Function[]> = new Map();

  constructor(queueName: string, options: any = {}) {}

  on(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)?.push(callback);
  }

  once(event: string, callback: Function) {
    const wrappedCallback = (...args: any[]) => {
      callback(...args);
      const listeners = this.listeners.get(event) || [];
      const index = listeners.indexOf(wrappedCallback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    };
    this.on(event, wrappedCallback);
  }

  emit(event: string, data: any) {
    const listeners = this.listeners.get(event) || [];
    listeners.forEach((callback) => callback(data));
  }

  async close() {
    return Promise.resolve(undefined);
  }
}

// Create a global mock queue instance
const globalMockQueue = new MockQueue();

mock.module("bullmq", () => ({
  Queue: function () {
    return globalMockQueue;
  },
  Worker: MockWorker,
  QueueEvents: function () {
    return globalMockQueue.getEvents();
  },
}));

// Export the mock classes for use in tests
export { MockQueue, MockQueueEvents, MockWorker };
