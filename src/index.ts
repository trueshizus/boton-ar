import { Hono } from "hono";
import client from "./services/reddit-api-client";

const app = new Hono();

app.get("/", (c) => c.text("Hello Bun!"));

app.get("/api/me", async (c) => {
  const me = await client.me();
  return c.json(me);
});

app.get("/api/subreddit/:subreddit/modqueue", async (c) => {
  const { offset } = c.req.query();
  const subreddit = c.req.param("subreddit");
  const subredditClient = client.subreddit(subreddit);
  const modqueueListing = await subredditClient.modqueue(offset);
  const modqueue = modqueueListing.data.children.map((redditThing) => {
    return {
      id: redditThing.data.id,
      author: redditThing.data.author,
      created_utc: redditThing.data.created_utc,
      created_at: new Date(redditThing.data.created_utc * 1000).toISOString(),
    };
  });

  return c.json(modqueue);
});

export default app;
