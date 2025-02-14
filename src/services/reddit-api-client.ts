import type { RedditListing } from "../types";

interface Credentials {
  clientId: string;
  clientSecret: string;
  username: string;
  password: string;
}

class RedditApiClient {
  private credentials: Credentials;
  private accessToken: string | null = null;
  private userAgent: string = "cli:botonar.local:v0.0.1 (by /u/BotonAr)";

  constructor(credentials: Credentials) {
    this.credentials = credentials;
  }

  // Obtain an access token using OAuth2 password grant.
  private async obtainAccessToken(): Promise<void> {
    const authString = `${this.credentials.clientId}:${this.credentials.clientSecret}`;
    const authHeader = "Basic " + Buffer.from(authString).toString("base64");

    const response = await fetch("https://www.reddit.com/api/v1/access_token", {
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
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Error obtaining access token:", errText);
      throw new Error(`Error obtaining access token: ${response.statusText}`);
    }

    const data = await response.json();
    this.accessToken = data.access_token;
  }

  // Ensure that we have a valid access token.
  private async ensureAccessToken(): Promise<void> {
    if (!this.accessToken) {
      await this.obtainAccessToken();
    }
  }

  // Construct authorization headers.
  private getAuthHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.accessToken}`,
      "User-Agent": this.userAgent,
    };
  }

  // Generic function to fetch subreddit listings.
  private async getSubredditListing(
    subredditName: string,
    listingType: string,
    after?: string
  ): Promise<any> {
    await this.ensureAccessToken();
    const url = new URL(
      `https://oauth.reddit.com/r/${subredditName}/${listingType}`
    );
    if (after) {
      url.searchParams.append("after", after);
    }

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(
        `Error fetching ${listingType} listing for subreddit ${subredditName}:`,
        errText
      );
      throw new Error(
        `Error fetching ${listingType} listing for subreddit ${subredditName}: ${response.statusText}`
      );
    }

    return response.json();
  }

  // Fetch the modqueue for a subreddit.
  private async getSubredditModqueue(
    subredditName: string,
    after?: string
  ): Promise<RedditListing> {
    await this.ensureAccessToken();
    const url = new URL(
      `https://oauth.reddit.com/r/${subredditName}/about/modqueue`
    );
    if (after) {
      url.searchParams.append("after", after);
    }

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(
        `Error fetching modqueue for subreddit ${subredditName}:`,
        errText
      );
      throw new Error(
        `Error fetching modqueue for subreddit ${subredditName}: ${response.statusText}`
      );
    }
    return response.json();
  }

  // Get information about the authenticated user.
  async me(): Promise<any> {
    await this.ensureAccessToken();
    const url = "https://oauth.reddit.com/api/v1/me";
    const response = await fetch(url, {
      method: "GET",
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Error fetching user data:", errText);
      throw new Error(`Error fetching user data: ${response.statusText}`);
    }
    return response.json();
  }

  // Approve a thing (e.g. a post or comment) by its fullname.
  async approve(thingName: string): Promise<any> {
    await this.ensureAccessToken();
    const url = "https://oauth.reddit.com/api/approve";
    const body = new URLSearchParams({ id: thingName });

    const response = await fetch(url, {
      method: "POST",
      body: body.toString(),
      headers: {
        ...this.getAuthHeaders(),
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`Error approving ${thingName}:`, errText);
      throw new Error(`Error approving ${thingName}: ${response.statusText}`);
    }
    return response.json();
  }

  // Remove a thing (e.g. a post or comment) by its fullname.
  async remove(thingName: string): Promise<any> {
    await this.ensureAccessToken();
    const url = "https://oauth.reddit.com/api/remove";
    const body = new URLSearchParams({ id: thingName });

    const response = await fetch(url, {
      method: "POST",
      body: body.toString(),
      headers: {
        ...this.getAuthHeaders(),
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`Error removing ${thingName}:`, errText);
      throw new Error(`Error removing ${thingName}: ${response.statusText}`);
    }
    return response.json();
  }

  // Return an object with methods to interact with a subreddit.
  subreddit(subredditName: string) {
    return {
      listing: (listingType: string, after?: string) =>
        this.getSubredditListing(subredditName, listingType, after),
      modqueue: (after?: string) =>
        this.getSubredditModqueue(subredditName, after),
    };
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
