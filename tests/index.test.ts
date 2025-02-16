import { describe, expect, it, mock } from "bun:test";
import app from "../src/server";
import mockClient from "./mocks/reddit-api-client";

mock.module("../src/services/reddit-api-client", mockClient);

describe("Health Check", () => {
  it("should return 'ok'", async () => {
    const req = new Request("http://localhost:3000/health");
    const res = await app.fetch(req);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ message: "ok" });
  });
});

describe("GET /api/me", () => {
  it("should return the user's information", async () => {
    const req = new Request("http://localhost:3000/api/me");
    const res = await app.fetch(req);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.name).toBe("BotonAr");
  });
});
