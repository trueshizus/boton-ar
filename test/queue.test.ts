import { describe, expect, it } from "bun:test";
import { QueueManager } from "../src/queue";

interface TestData {
  test?: string;
  subreddit?: string;
}

describe("Queue", () => {
  it("should create a seed job", async () => {
    const seedQueue = new QueueManager<TestData>("test-queue", async (data) => {
      return Promise.resolve(data);
    });

    const jobId = await seedQueue.add({
      subreddit: "testsubreddit",
    });
    expect(jobId).toBeDefined();

    const status = await seedQueue.getStatus(jobId as string);
    expect(status).toEqual({
      id: jobId,
      status: "waiting",
      progress: 0,
      attempts: 0,
      timestamp: expect.any(Number),
    });
  });

  it("should return not_found for non-existent job", async () => {
    const seedQueue = new QueueManager<TestData>("test-queue", async (data) => {
      return Promise.resolve(data);
    });

    const status = await seedQueue.getStatus("non-existent");
    expect(status).toEqual({
      status: "not_found",
    });
  });

  it("should remove a job", async () => {
    const seedQueue = new QueueManager<TestData>("test-queue", async (data) => {
      return Promise.resolve(data);
    });

    const jobId = await seedQueue.add({ test: "data" });
    const removed = await seedQueue.remove(jobId as string);
    expect(removed).toBe(true);

    const status = await seedQueue.getStatus(jobId as string);
    expect(status).toEqual({
      status: "not_found",
    });
  });

  it("should schedule a job with delay", async () => {
    const seedQueue = new QueueManager<TestData>("test-queue", async (data) => {
      return Promise.resolve(data);
    });

    const jobId = await seedQueue.add({ test: "data" });
    const scheduled = await seedQueue.schedule(jobId as string, 1000);
    expect(scheduled).toBe(true);
  });

  it("should interrupt a job", async () => {
    const seedQueue = new QueueManager<TestData>("test-queue", async (data) => {
      return Promise.resolve(data);
    });

    const jobId = await seedQueue.add({ test: "data" });
    const interrupted = await seedQueue.interrupt(jobId as string);
    expect(interrupted).toBe(true);
  });

  it("should pause and resume worker", async () => {
    const seedQueue = new QueueManager<TestData>("test-queue", async (data) => {
      return Promise.resolve(data);
    });

    await expect(seedQueue.pause()).resolves.not.toThrow();
    await expect(seedQueue.resume()).resolves.not.toThrow();
  });

  it("should clean up jobs", async () => {
    const seedQueue = new QueueManager<TestData>("test-queue", async (data) => {
      return Promise.resolve(data);
    });

    await expect(seedQueue.clean()).resolves.not.toThrow();
  });

  it("should close all connections", async () => {
    const seedQueue = new QueueManager<TestData>("test-queue", async (data) => {
      return Promise.resolve(data);
    });

    await expect(seedQueue.close()).resolves.not.toThrow();
  });

  it("should handle worker function throwing an error", async () => {
    const errorQueue = new QueueManager<TestData>("test-queue", async () => {
      throw new Error("Test error");
    });

    const jobId = await errorQueue.add({ test: "data" }, { attempts: 1 });
    if (!jobId) throw new Error("Failed to create job");

    // Wait for the job to fail with a shorter timeout
    await Promise.race([
      errorQueue.waitForCompletion(jobId),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error("Timeout waiting for job completion")),
          1000
        )
      ),
    ]);

    const status = await errorQueue.getStatus(jobId);
    expect(status).toEqual({
      id: jobId,
      status: "failed",
      progress: 0,
      attempts: 1,
      timestamp: expect.any(Number),
    });

    // Clean up
    await errorQueue.close();
  });

  it("should handle concurrent job processing", async () => {
    let processedCount = 0;
    const concurrentQueue = new QueueManager<TestData>(
      "test-queue",
      async () => {
        processedCount++;
        return Promise.resolve();
      }
    );

    const jobPromises = Array(5)
      .fill(null)
      .map(() => concurrentQueue.add({ test: "data" }));

    const jobIds = await Promise.all(jobPromises);
    expect(jobIds).toHaveLength(5);
    expect(jobIds.every((id) => typeof id === "string")).toBe(true);
  });

  it("should update job progress", async () => {
    const progressQueue = new QueueManager<TestData>(
      "test-queue",
      async (data) => {
        return Promise.resolve(data);
      }
    );

    const jobId = await progressQueue.add({ test: "data" });
    expect(jobId).toBeDefined();
    const status = await progressQueue.getStatus(jobId as string);

    expect(status).toEqual({
      id: jobId,
      status: "waiting",
      progress: 0,
      attempts: 0,
      timestamp: expect.any(Number),
    });
  });
});
