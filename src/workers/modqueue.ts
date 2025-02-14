import client from "../services/reddit-api-client";
import { Cache } from "../services/cache";

export async function pollModqueue(subreddit: string) {
  try {
    const cache = Cache.getInstance();
    const cacheKey = `modqueue:${subreddit}`;

    const subredditClient = client.subreddit(subreddit);
    const modqueueListing = await subredditClient.modqueue();

    const modqueue = modqueueListing.data.children.map((redditThing) => ({
      id: redditThing.data.id,
      author: redditThing.data.author,
      created_utc: redditThing.data.created_utc,
      created_at: new Date(redditThing.data.created_utc * 1000).toISOString(),
      permalink: redditThing.data.permalink,
    }));

    cache.set(cacheKey, modqueue);

    return modqueue;
  } catch (error) {
    console.error("Error polling modqueue:", error);
    throw error;
  }
}
