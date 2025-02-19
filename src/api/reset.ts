import { Hono } from "hono";
import db from "../db";
import { modqueueItemsTable, postsTable, syncStatusTable } from "../db/schema";
import { trackedSubredditsTable } from "../db/schema";
import { commentsTable } from "../db/schema";

const app = new Hono();

app.post("/", async (c) => {
  await db.delete(trackedSubredditsTable);
  await db.delete(modqueueItemsTable);
  await db.delete(syncStatusTable);
  await db.delete(commentsTable);
  await db.delete(postsTable);

  return c.json({ message: "ok" });
});

export default app;
