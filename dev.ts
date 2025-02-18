import createRedditClient from "./src/services/reddit-api-client";

const client = createRedditClient();

const sample = await client.subreddit("AskArgentina").inbox().conversations();

// store in a json file

Bun.write("sample.json", JSON.stringify(sample, null, 2));
