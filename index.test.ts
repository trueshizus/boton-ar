import { describe, expect, it, mock, beforeAll, afterEach } from "bun:test";
import app from "./src/server";
import client from "./src/services/reddit-api-client";
import modqueue from "./tests/fixtures/modqueue.json";
import me from "./tests/fixtures/me.json";
// Mock external dependenciess
mock.module("./services/reddit-api-client", () => ({
  default: {
    me: mock(() => Promise.resolve(me)),
    subreddit: mock((name: string) => ({
      modqueue: mock(() => Promise.resolve(modqueue)),
    })),
    approve: mock(() => Promise.resolve({})),
    remove: mock(() => Promise.resolve({})),
  },
}));

mock.module("./queue", () => ({
  addSeedJob: mock((subreddit: string) => Promise.resolve("job-123")),
  getSeedJobStatus: mock((jobId: string) =>
    Promise.resolve({
      id: jobId,
      status: "completed",
      progress: 100,
      attempts: 1,
      timestamp: Date.now(),
    })
  ),
}));

describe("Server", () => {
  const makeRequest = (path: string, options = {}) =>
    app.request(path, options);

  //   beforeAll(() => {
  //   });

  afterEach(() => {
    mock.restore();
  });

  describe("GET /api/me", () => {
    it("should return user data", async () => {
      const res = await makeRequest("/api/me");
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual(me);
    });
  });

  describe("POST /api/subreddit", () => {
    it.only("should add new subreddit", async () => {
      const res = await makeRequest("/api/subreddit", {
        method: "POST",
        body: JSON.stringify({ subreddit: "testsubreddit" }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe("success");
    });
  });

  describe("GET /api/subreddit/:subreddit/modqueue", () => {
    it("should fetch modqueue", async () => {
      const res = await makeRequest("/api/subreddit/testsubreddit/modqueue");
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data.children).toBeArray();
    });

    it("should handle offset parameter", async () => {
      const res = await makeRequest(
        "/api/subreddit/testsubreddit/modqueue?offset=t3_123"
      );
      expect(res.status).toBe(200);
    });
  });

  describe("POST /api/subreddit/:subreddit/modqueue/seed", () => {
    it("should schedule seed job", async () => {
      const res = await makeRequest(
        "/api/subreddit/testsubreddit/modqueue/seed",
        { method: "POST" }
      );

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.jobId).toBe("job-123");
      expect(data.status).toBe("pending");
    });
  });

  describe("GET /api/subreddit/:subreddit/modqueue/seed/status/:jobId", () => {
    it("should return job status", async () => {
      const res = await makeRequest(
        "/api/subreddit/testsubreddit/modqueue/seed/status/job-123"
      );

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe("completed");
      expect(data.progress).toBe(100);
    });
  });

  describe("POST /api/approve/:thing", () => {
    it("should approve content", async () => {
      const res = await makeRequest("/api/approve/t3_123abc", {
        method: "POST",
      });

      expect(res.status).toBe(200);
    });

    it("should validate thing ID format", async () => {
      const res = await makeRequest("/api/approve/invalid_id", {
        method: "POST",
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe("Invalid thing ID format");
    });
  });

  describe("POST /api/remove/:thing", () => {
    it("should remove content", async () => {
      const res = await makeRequest("/api/remove/t3_123abc", {
        method: "POST",
      });

      expect(res.status).toBe(200);
    });

    it("should validate thing ID format", async () => {
      const res = await makeRequest("/api/remove/invalid_id", {
        method: "POST",
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe("Invalid thing ID format");
    });
  });

  describe("Rate limiting", () => {
    it("should limit repeated requests", async () => {
      // First request should succeed
      const res1 = await makeRequest("/api/me");
      expect(res1.status).toBe(200);

      // Immediate second request should be rate limited
      const res2 = await makeRequest("/api/me");
      expect(res2.status).toBe(429);
      const data = await res2.json();
      expect(data.error).toBe("Too many requests");
    });
  });
});
