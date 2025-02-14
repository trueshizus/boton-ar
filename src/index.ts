import { Hono } from "hono";
import client from "./services/reddit-api-client";

const app = new Hono();

app.get("/", (c) => c.text("Hello Bun!"));

app.get("/api/me", async (c) => {
  const me = await client.me();
  return c.json(me);
});

app.get("/api/subreddit/:subreddit/modqueue", async (c) => {
  const subreddit = c.req.param("subreddit");
  const subredditClient = client.subreddit(subreddit);
  const modqueue = await subredditClient.modqueue();
  return c.json(modqueue);
});

export default app;
