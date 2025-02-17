import { describe, expect, it, mock } from "bun:test";
import app from "../src/server";
import mockClient from "../test/mocks/reddit-api-client";

mock.module("../src/services/reddit-api-client", () => mockClient);

describe("GET /api/me", () => {
  it("should return the user's information", async () => {
    const req = new Request("http://localhost:3000/api/me");
    const res = await app.fetch(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data).toBeDefined();
    expect(data.name).toBe("BotonAr");
  });
});
