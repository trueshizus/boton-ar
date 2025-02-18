import { describe, expect, it, mock } from "bun:test";
import app from "../src/server";

describe("GET /api/me", () => {
  const baseUrl = process.env.BASE_URL;
  it("should return the user's information", async () => {
    const req = new Request(`${baseUrl}/api/me`);
    const res = await app.fetch(req);

    const data = await res.json();
    expect(data).toBeDefined();
    expect(data.name).toBe("BotonAr");
  });
});
