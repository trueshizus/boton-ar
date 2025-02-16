import { describe, it, expect } from "bun:test";
import { Hono } from "hono";

// Create a minimal version of the app for testing
const app = new Hono();
app.get("/health", (c) => {
  return c.json({ message: "ok" });
});

describe("Health Check", () => {
  it("should return 'ok'", async () => {
    const req = new Request("http://localhost:3000/health");
    const res = await app.fetch(req);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ message: "ok" });
  });
});
