import { describe, expect, it, mock, beforeEach, afterEach } from "bun:test";
import { QueueManager } from "../src/queue";
// Import the mock classes from setup.ts
import { MockQueue, MockQueueEvents, MockWorker } from "./setup";

// Create instances of the mock classes *outside* of mock.module
const globalMockQueue = new MockQueue();
const globalMockQueueEvents = new MockQueueEvents("", {});

// Mock the entire bullmq module *before* beforeEach
mock.module("bullmq", () => ({
  Queue: function () {
    return globalMockQueue;
  },
  Worker: MockWorker,
  QueueEvents: function () {
    return globalMockQueueEvents; // Use the instance
  },
}));

interface TestData {
  test?: string;
  subreddit?: string;
}

describe("QueueManager", () => {
  let seedQueue: QueueManager<TestData>;

  beforeEach(() => {
    seedQueue = new QueueManager<TestData>("seedQueue", async (data) => data, {
      pollInterval: 100,
    });
  });

  afterEach(async () => {
    await seedQueue.close();
  });

  it("should create a new job", async () => {
    const mockJob = { id: "1", data: { test: "data" } };
    const jobId = await seedQueue.add(mockJob.data);
    expect(jobId).toBeDefined();
    expect(globalMockQueue.jobs.size).toBe(1);
  });

  it("should process a job", async () => {
    const mockJob = { data: { test: "data" } };
    const jobId = await seedQueue.add(mockJob.data);
    expect(jobId).toBeDefined();

    // Get the job status
    const status = await seedQueue.getStatus(jobId);
    expect(status.status).toBe("waiting");
  });

  it("should get job status", async () => {
    const mockJob = { data: { test: "data" } };
    const jobId = await seedQueue.add(mockJob.data);
    const status = await seedQueue.getStatus(jobId);
    expect(status.status).toBe("waiting");
  });

  it("should handle errors during job processing", async () => {
    const mockJob = { data: { test: "data" } };
    const jobId = await seedQueue.add(mockJob.data);
    expect(jobId).toBeDefined();

    const job = await globalMockQueue.getJob(jobId);
    expect(job).toBeDefined();
    expect(await job.getState()).toBe("waiting");
  });

  it("should clean the queue", async () => {
    const mockJob = { data: { test: "data" } };
    await seedQueue.add(mockJob.data);
    expect(globalMockQueue.jobs.size).toBe(1);

    await seedQueue.clean();
    expect(globalMockQueue.jobs.size).toBe(0);
  });

  it("should pause and resume the queue", async () => {
    await seedQueue.pause();
    await seedQueue.resume();
  });

  it("should close the queue and worker", async () => {
    await seedQueue.close();
  });
});
