import { describe, expect, it } from "bun:test";
import app from "../src/server";

describe("GET /health", () => {
  it("should return 'ok'", async () => {
    const req = new Request("http://localhost:3000/health");
    const res = await app.fetch(req);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data).toEqual({ message: "ok" });
  });
});
