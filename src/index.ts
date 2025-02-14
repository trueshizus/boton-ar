import { Hono } from "hono";
import client from "./services/reddit-api-client";

const app = new Hono();

app.get("/", (c) => c.text("Hello Bun!"));

app.get("/api/me", async (c) => {
  const me = await client.me();
  return c.json(me);
});

export default app;
