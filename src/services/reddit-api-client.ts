import type {
  RedditAbout,
  RedditListing,
  RedditMe,
  ConversationsResponse,
} from "../types";
import { tokenManager } from "./token-manager";
import logger from "../logger";

interface Credentials {
  clientId: string;
  clientSecret: string;
  username: string;
  password: string;
}

type QueueType = "main" | "modqueue" | "removed" | "user";

const USER_AGENT = "cli:botonar.local:v0.0.1 (by /u/BotonAr)";

const createApiRequest = (credentials: Credentials) => {
  const obtainAccessToken = async (): Promise<void> => {
    logger.info("🔑 Obtaining new Reddit access token");
    const authString = `${credentials.clientId}:${credentials.clientSecret}`;
    const authHeader = "Basic " + Buffer.from(authString).toString("base64");

    try {
      const response = await fetch(
        "https://www.reddit.com/api/v1/access_token",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: authHeader,
          },
          body: new URLSearchParams({
            grant_type: "password",
            username: credentials.username,
            password: credentials.password,
          }),
        }
      );

      if (!response.ok) {
        const errText = await response.text();
        logger.error("Token fetch failed", { errText });
        throw new Error(`Error obtaining access token: ${errText}`);
      }

      const data = await response.json();

      // Use tokenManager to store the token
      await tokenManager.set(data.access_token, data.expires_in);
      logger.info("✅ Reddit access token acquired");
    } catch (error) {
      logger.error("❌ Error during token acquisition", { error });
      throw error;
    }
  };

  const ensureAccessToken = async (): Promise<string> => {
    // Use tokenManager to retrieve the token

    const token = tokenManager.get();
    if (!token) {
      await obtainAccessToken();
      return tokenManager.get()!;
    }

    return token;
  };

  const request = async <T>(
    endpoint: string,
    method: "GET" | "POST" = "GET",
    params?: Record<string, any>,
    body?: URLSearchParams,
    retryOnAuthFailure = true
  ): Promise<T> => {
    let token = await ensureAccessToken();

    const url = new URL(`https://oauth.reddit.com${endpoint}`);

    // Attach any query parameters to the URL
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          url.searchParams.append(key, value.toString());
        }
      });
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      "User-Agent": USER_AGENT,
    };

    if (method === "POST" && body) {
      headers["Content-Type"] = "application/x-www-form-urlencoded";
    }

    try {
      const response = await fetch(url.toString(), {
        method,
        headers,
        body: method === "POST" ? body : undefined,
      });

      // If token expired (401), try to refresh once
      if (response.status === 401 && retryOnAuthFailure) {
        logger.warn(
          "401 Unauthorized - refreshing token and retrying request..."
        );
        await obtainAccessToken();
        // Avoid infinite loop by setting retryOnAuthFailure to false
        return request(endpoint, method, params, body, false);
      }

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(
          `API Error (${response.status}): ${errText} - endpoint: ${endpoint} - method: ${method}`
        );
      }

      return await response.json();
    } catch (error) {
      logger.error("❌ API request error", { endpoint, error, method });
      throw error;
    }
  };

  return request;
};

const createQueue = (
  request: ReturnType<typeof createApiRequest>,
  subredditName: string
) => {
  const getQueueEndpoint = (queueType: QueueType) => {
    switch (queueType) {
      case "main":
        return `/r/${subredditName}/new`;
      case "modqueue":
        return `/r/${subredditName}/about/modqueue`;
      case "removed":
        return `/r/${subredditName}/about/removed`;
      case "user":
        return `/r/${subredditName}/about/contributors`;
      default:
        throw new Error(`Unknown queue type: ${queueType}`);
    }
  };

  return (queueType: QueueType) => ({
    posts: () => request<RedditListing>(getQueueEndpoint(queueType)),
    post: (postId: string) => request(`/r/${subredditName}/comments/${postId}`),
    count: async () => {
      const data = await request<RedditListing>(getQueueEndpoint(queueType));
      return data?.data?.children?.length ?? 0;
    },
  });
};

/**
 * Create inbox operations for a subreddit (via Modmail, etc.).
 */

const createInbox = (
  request: ReturnType<typeof createApiRequest>,
  subredditName: string
) => ({
  conversations: (): Promise<ConversationsResponse> =>
    request(`/api/mod/conversations`, "GET", {
      entity: subredditName,
    }),
  conversation: (conversationId: string) =>
    request(`/api/mod/conversations/${conversationId}`),
});

const createMod = (
  request: ReturnType<typeof createApiRequest>,
  subredditName: string
) => ({
  approve: (id: string) =>
    request("/api/approve", "POST", undefined, new URLSearchParams({ id })),
  remove: (id: string) =>
    request("/api/remove", "POST", undefined, new URLSearchParams({ id })),
  block: (userId: string) =>
    request(
      `/r/${subredditName}/api/block_user`,
      "POST",
      undefined,
      new URLSearchParams({ user: userId })
    ),
  modqueue: () => createQueue(request, subredditName)("modqueue"),
  unmoderated: () => request(`/r/${subredditName}/about/unmoderated`),
  removed: () => createQueue(request, subredditName)("removed"),
});

const createSubreddit = (
  request: ReturnType<typeof createApiRequest>,
  name: string
) => ({
  about: () => Promise.resolve({ description: "not_implemented" }), //request<RedditAbout>(`/r/${name}/about`),
  config: () => Promise.resolve({ description: "not_implemented" }), //request(`/r/${name}/api/site_admin`),
  queue: (queueType: QueueType) => createQueue(request, name)(queueType),
  inbox: () => createInbox(request, name),
  mod: () => createMod(request, name),
});

const createRedditClient = (credentials: Credentials) => {
  const request = createApiRequest(credentials);
  return {
    subreddit: (name: string) => createSubreddit(request, name),
    me: () => request<RedditMe>("/api/v1/me"),
  };
};

const credentials: Credentials = {
  clientId: process.env.REDDIT_CLIENT_ID!,
  clientSecret: process.env.REDDIT_CLIENT_SECRET!,
  username: process.env.REDDIT_USERNAME!,
  password: process.env.REDDIT_PASSWORD!,
};

let redditClientInstance: ReturnType<typeof createRedditClient> | null = null;

export default () => {
  if (!redditClientInstance) {
    redditClientInstance = createRedditClient(credentials);
  }
  return redditClientInstance;
};
