import { mock } from "bun:test";
import me from "../fixtures/me.json" assert { type: "json" };
import modqueue from "../fixtures/modqueue.json" assert { type: "json" };

class MockConversationManager {
  private conversationId: string;

  constructor(conversationId: string) {
    this.conversationId = conversationId;
  }

  async approve(): Promise<void> {}
  async archive(): Promise<void> {}
  async disapprove(): Promise<void> {}
  async highlight(): Promise<void> {}
  async mute(): Promise<void> {}
  async unmute(): Promise<void> {}
  async reply(): Promise<void> {}
}

class MockModManager {
  private subredditName: string;

  constructor(subredditName: string) {
    this.subredditName = subredditName;
  }

  async inbox(): Promise<MockConversationManager[]> {
    return [new MockConversationManager("123")];
  }

  conversation(id: string): MockConversationManager {
    return new MockConversationManager(id);
  }
}

class MockSubredditManager {
  private subredditName: string;

  constructor(subredditName: string) {
    this.subredditName = subredditName;
  }

  mod(): MockModManager {
    return new MockModManager(this.subredditName);
  }

  async modqueue() {
    return modqueue;
  }

  async listing() {
    return {
      kind: "Listing",
      data: {
        after: null,
        children: [],
      },
    };
  }
}

class MockRedditApiClient {
  private accessToken: string | null = null;

  constructor(credentials: any) {
    // Store credentials if needed
  }

  async obtainAccessToken(): Promise<void> {
    this.accessToken = "mock_access_token";
  }

  async ensureAccessToken(): Promise<void> {
    if (!this.accessToken) {
      await this.obtainAccessToken();
    }
  }

  async me() {
    await this.ensureAccessToken();
    return me;
  }

  async approve(thingName: string) {
    await this.ensureAccessToken();
    return {};
  }

  async remove(thingName: string) {
    await this.ensureAccessToken();
    return {};
  }

  subreddit(subredditName: string): MockSubredditManager {
    return new MockSubredditManager(subredditName);
  }
}

const mockClient = new MockRedditApiClient({});

export default {
  default: mockClient,
  RedditApiClient: mockClient,
};
