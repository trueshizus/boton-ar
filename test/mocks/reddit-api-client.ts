import { mock } from "bun:test";
import me from "../fixtures/me.json" assert { type: "json" };
import modqueue from "../fixtures/modqueue.json" assert { type: "json" };

class MockRedditApiClient {
  private accessToken: string | null = null;

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

  subreddit(subredditName: string) {
    return {
      listing: async () => ({
        kind: "Listing",
        data: {
          after: null,
          children: [],
        },
      }),
      modqueue: async () => {
        await this.ensureAccessToken();
        return modqueue;
      },
    };
  }
}

const mockClient = new MockRedditApiClient();

export default () => ({
  default: mockClient,
});
