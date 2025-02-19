import { Hono } from "hono";
import logger from "../logger";
import createClient from "../services/reddit-api-client";

const app = new Hono();
const client = createClient();

app.get("/", async (c) => {
  try {
    logger.info("🔍 Fetching authenticated user data");
    const me = await client.me();
    logger.info("✅ Successfully fetched user data");
    return c.json(me);
  } catch (err) {
    logger.error("❌ Error fetching user info", { error: err });
    return c.json({ error: "Error fetching user info" }, 500);
  }
});

export default app;
