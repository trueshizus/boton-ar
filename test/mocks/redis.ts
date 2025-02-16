import { beforeAll, afterAll, afterEach } from "bun:test";

interface QueueJob {
  id: string;
  name: string;
  data: any;
  opts: any;
  timestamp: number;
  status: "waiting" | "active" | "completed" | "failed" | "delayed";
  progress: number;
  attemptsMade: number;
  returnvalue?: any;
  failedReason?: string;
}

class MockQueue {
  private jobs: Map<string, QueueJob> = new Map();
  private jobCounter = 0;
  private name: string;
  private options: any;

  constructor(name: string, options: any = {}) {
    this.name = name;
    this.options = options;
  }

  async add(name: string, data: any, opts: any = {}) {
    const id = String(++this.jobCounter);
    const job: QueueJob = {
      id,
      name,
      data,
      opts,
      timestamp: Date.now(),
      status: opts.delay ? "delayed" : "waiting",
      progress: 0,
      attemptsMade: 0,
    };

    this.jobs.set(id, job);
    return {
      id,
      name,
      data,
      opts,
      remove: () => this.remove(id),
      moveToDelayed: (timestamp: number) => this.moveToDelayed(id, timestamp),
      moveToFailed: (reason: { message: string }) =>
        this.moveToFailed(id, reason),
      getState: () => this.getJobState(id),
      progress: () => this.getJobProgress(id),
    };
  }

  async getJob(id: string) {
    const job = this.jobs.get(id);
    if (!job) return null;

    return {
      id: job.id,
      name: job.name,
      data: job.data,
      opts: job.opts,
      timestamp: job.timestamp,
      attemptsMade: job.attemptsMade,
      remove: () => this.remove(id),
      moveToDelayed: (timestamp: number) => this.moveToDelayed(id, timestamp),
      moveToFailed: (reason: { message: string }) =>
        this.moveToFailed(id, reason),
      getState: () => this.getJobState(id),
      progress: () => this.getJobProgress(id),
    };
  }

  private async remove(id: string) {
    return this.jobs.delete(id);
  }

  private async moveToDelayed(id: string, timestamp: number) {
    const job = this.jobs.get(id);
    if (job) {
      job.status = "delayed";
      return true;
    }
    return false;
  }

  private async moveToFailed(id: string, reason: { message: string }) {
    const job = this.jobs.get(id);
    if (job) {
      job.status = "failed";
      job.failedReason = reason.message;
      return true;
    }
    return false;
  }

  private async getJobState(id: string) {
    return this.jobs.get(id)?.status || "not_found";
  }

  private async getJobProgress(id: string) {
    return this.jobs.get(id)?.progress || 0;
  }

  async clean(grace: number, limit: number, type: string) {
    const now = Date.now();
    for (const [id, job] of this.jobs.entries()) {
      if (job.status === type && now - job.timestamp > grace) {
        this.jobs.delete(id);
      }
    }
  }

  async close() {
    this.jobs.clear();
  }
}

class MockWorker {
  private queue: MockQueue;
  private processor: Function;
  private running: boolean = false;
  private options: any;

  constructor(queueName: string, processor: Function, options: any = {}) {
    this.queue = new MockQueue(queueName);
    this.processor = processor;
    this.options = options;
  }

  async pause() {
    this.running = false;
  }

  async resume() {
    this.running = true;
  }

  async close() {
    this.running = false;
  }
}

class MockQueueEvents {
  private listeners: Map<string, Function[]> = new Map();
  private name: string;

  constructor(name: string, options: any = {}) {
    this.name = name;
  }

  on(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)?.push(callback);
  }

  async close() {
    this.listeners.clear();
  }
}

// Export the mock classes for use in tests
export { MockQueue, MockWorker, MockQueueEvents };

// Clean up mock data after each test
afterEach(() => {
  // Reset any stored queue data
});
