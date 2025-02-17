import type { RedditListing } from "../types";
import { tokenManager } from "./token-manager";
import logger from "../logger";

const DEFAULT_LIMIT = 100;

interface Credentials {
  clientId: string;
  clientSecret: string;
  username: string;
  password: string;
}

interface ModmailConversation {
  id: string;
  subject: string;
  isAuto: boolean;
  isHighlighted: boolean;
  isInternal: boolean;
  isRepliable: boolean;
  state: string;
  lastUpdated: string;
  lastUserUpdate: string;
}

class ConversationManager {
  private client: RedditApiClient;
  private conversationId: string;

  constructor(client: RedditApiClient, conversationId: string) {
    this.client = client;
    this.conversationId = conversationId;
  }

  async approve(): Promise<void> {
    await this.client.performModAction(this.conversationId, "approve");
  }

  async archive(): Promise<void> {
    await this.client.performModAction(this.conversationId, "archive");
  }

  async disapprove(): Promise<void> {
    await this.client.performModAction(this.conversationId, "disapprove");
  }

  async highlight(): Promise<void> {
    await this.client.performModAction(this.conversationId, "highlight");
  }

  async mute(duration: number = 72): Promise<void> {
    await this.client.performModAction(this.conversationId, "mute", {
      duration,
    });
  }

  async tempBan(duration: number): Promise<void> {
    await this.client.performModAction(this.conversationId, "temp_ban", {
      duration,
    });
  }

  async unarchive(): Promise<void> {
    await this.client.performModAction(this.conversationId, "unarchive");
  }

  async unban(): Promise<void> {
    await this.client.performModAction(this.conversationId, "unban");
  }

  async unmute(): Promise<void> {
    await this.client.performModAction(this.conversationId, "unmute");
  }

  async reply(body: string, isInternal: boolean = false): Promise<void> {
    await this.client.replyToModmail(this.conversationId, body, isInternal);
  }
}

class ModManager {
  private client: RedditApiClient;
  private subredditName: string;

  constructor(client: RedditApiClient, subredditName: string) {
    this.client = client;
    this.subredditName = subredditName;
  }

  async inbox(
    params: {
      state?:
        | "new"
        | "inprogress"
        | "mod"
        | "notifications"
        | "archived"
        | "highlighted"
        | "all";
      sort?: "recent" | "unread" | "mod";
      limit?: number;
      after?: string;
    } = {}
  ): Promise<ModmailConversation[]> {
    const response = await this.client.fetchModmailConversations(
      this.subredditName,
      params
    );
    return response.conversations.map(
      (conv: any) => new ConversationManager(this.client, conv.id)
    );
  }

  conversation(id: string): ConversationManager {
    return new ConversationManager(this.client, id);
  }
}

class SubredditManager {
  private client: RedditApiClient;
  private subredditName: string;

  constructor(client: RedditApiClient, subredditName: string) {
    this.client = client;
    this.subredditName = subredditName;
  }

  async modqueue(
    params: { after?: string; limit?: number } = {}
  ): Promise<RedditListing> {
    return this.client.getModqueue(
      this.subredditName,
      params.after,
      params.limit
    );
  }

  mod(): ModManager {
    return new ModManager(this.client, this.subredditName);
  }

  // ... other subreddit methods can go here ...
}

export class RedditApiClient {
  private credentials: Credentials;
  private userAgent: string = "cli:botonar.local:v0.0.1 (by /u/BotonAr)";

  constructor(credentials: Credentials) {
    this.credentials = credentials;
  }

  private async obtainAccessToken(): Promise<void> {
    logger.info("🔑 Obtaining new Reddit access token");
    const authString = `${this.credentials.clientId}:${this.credentials.clientSecret}`;
    const authHeader = "Basic " + Buffer.from(authString).toString("base64");

    try {
      const response = await fetch(
        "https://www.reddit.com/api/v1/access_token",
        {
          method: "POST",
          body: new URLSearchParams({
            grant_type: "password",
            username: this.credentials.username,
            password: this.credentials.password,
          }),
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: authHeader,
          },
        }
      );

      if (!response.ok) {
        const errText = await response.text();
        logger.error("❌ Failed to obtain access token", {
          status: response.status,
          error: errText,
        });
        throw new Error(`Error obtaining access token: ${errText}`);
      }

      const data = await response.json();
      await tokenManager.set(data.access_token, data.expires_in);
      logger.info("✅ Successfully obtained new access token");
    } catch (error) {
      logger.error("❌ Error during token acquisition", { error });
      throw error;
    }
  }

  private async ensureAccessToken(): Promise<string> {
    const token = tokenManager.get();
    if (!token) {
      await this.obtainAccessToken();
      return tokenManager.get()!; // We just obtained it, so it's safe to assert.
    }
    return token;
  }

  private async getAuthHeaders(): Promise<Record<string, string>> {
    const token = await this.ensureAccessToken();
    return {
      Authorization: `Bearer ${token}`,
      "User-Agent": this.userAgent,
    };
  }

  private async request(
    endpoint: string,
    method: "GET" | "POST" = "GET",
    params?: Record<string, any>,
    body?: URLSearchParams
  ): Promise<any> {
    const url = new URL(`https://oauth.reddit.com${endpoint}`);

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          url.searchParams.append(key, value.toString());
        }
      });
    }

    logger.debug("🌐 Making Reddit API request", {
      method,
      endpoint,
      params: params ? JSON.stringify(params) : undefined,
    });

    const headers = await this.getAuthHeaders();
    if (method === "POST" && body) {
      headers["Content-Type"] = "application/x-www-form-urlencoded";
    }

    try {
      const response = await fetch(url.toString(), {
        method,
        headers,
        body: method === "POST" ? body : undefined,
      });

      logger.debug("📨 Received API response", {
        status: response.status,
        endpoint,
      });

      if (!response.ok) {
        const errText = await response.text();
        logger.error("❌ API request failed", {
          status: response.status,
          endpoint,
          error: errText,
        });
        throw new Error(`API Error (${response.status}): ${errText}`);
      }

      const data = await response.json();
      logger.debug("✅ API request completed successfully", { endpoint });
      return data;
    } catch (error) {
      logger.error("❌ API request error", {
        endpoint,
        error,
        method,
      });
      throw error;
    }
  }

  // Fetch the modqueue for a subreddit.
  private async getSubredditModqueue(
    subredditName: string,
    after?: string,
    limit?: number
  ): Promise<RedditListing> {
    const response = await this.request(
      `/r/${subredditName}/about/modqueue`,
      "GET",
      {
        limit: limit?.toString() ?? DEFAULT_LIMIT.toString(),
        after: after,
      }
    );
    return response;
  }

  // Get information about the authenticated user.
  async me(): Promise<any> {
    logger.info("👤 Fetching authenticated user information");
    try {
      const response = await this.request("/api/v1/me");
      logger.info("✅ Successfully retrieved user information");
      return response;
    } catch (error) {
      logger.error("❌ Failed to fetch user information", { error });
      throw error;
    }
  }

  // Approve a thing (e.g. a post or comment) by its fullname.
  async approve(thingName: string): Promise<any> {
    logger.info("👍 Approving content", { thingName });
    try {
      const response = await this.request(
        "/api/approve",
        "POST",
        undefined,
        new URLSearchParams({ id: thingName })
      );
      logger.info("✅ Successfully approved content", { thingName });
      return response;
    } catch (error) {
      logger.error("❌ Failed to approve content", { thingName, error });
      throw error;
    }
  }

  // Remove a thing (e.g. a post or comment) by its fullname.
  async remove(thingName: string): Promise<any> {
    logger.info("🚫 Removing content", { thingName });
    try {
      const response = await this.request(
        "/api/remove",
        "POST",
        undefined,
        new URLSearchParams({ id: thingName })
      );
      logger.info("✅ Successfully removed content", { thingName });
      return response;
    } catch (error) {
      logger.error("❌ Failed to remove content", { thingName, error });
      throw error;
    }
  }

  // Return an object with methods to interact with a subreddit.
  subreddit(name: string): SubredditManager {
    return new SubredditManager(this, name);
  }

  // Get modmail conversations
  async fetchModmailConversations(
    subredditName: string,
    params: {
      state?: string; // new|inprogress|mod|notifications|archived|highlighted|all
      sort?: string; // recent|unread|mod
      limit?: number; // max 100
      after?: string; // for pagination
    } = {}
  ): Promise<any> {
    return this.request(
      `/api/mod/conversations/${subredditName}`,
      "GET",
      params
    );
  }

  // Get a specific modmail conversation
  async fetchModmailConversation(
    subredditName: string,
    conversationId: string
  ): Promise<any> {
    return this.request(
      `/api/mod/conversations/${subredditName}/${conversationId}`,
      "GET"
    );
  }

  // Reply to a modmail conversation
  async replyToModmail(
    conversationId: string,
    body: string,
    isInternal: boolean = false
  ): Promise<any> {
    const formData = new URLSearchParams({
      body,
      isInternal: isInternal.toString(),
    });
    return this.request(
      `/api/mod/conversations/${conversationId}`,
      "POST",
      undefined,
      formData
    );
  }

  public async performModAction(
    conversationId: string,
    action: string,
    params: Record<string, any> = {}
  ): Promise<any> {
    const formData = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      formData.append(key, value.toString());
    });

    return this.request(
      `/api/mod/conversations/${conversationId}/${action}`,
      "POST",
      undefined,
      formData
    );
  }

  public async getModqueue(
    subredditName: string,
    after?: string,
    limit?: number
  ): Promise<RedditListing> {
    return this.getSubredditModqueue(subredditName, after, limit);
  }
}

// Load credentials from environment variables.
const credentials: Credentials = {
  clientId: process.env.REDDIT_CLIENT_ID!,
  clientSecret: process.env.REDDIT_CLIENT_SECRET!,
  username: process.env.REDDIT_USERNAME!,
  password: process.env.REDDIT_PASSWORD!,
};

const client = new RedditApiClient(credentials);

export default client;
