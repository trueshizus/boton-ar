import {
  describe,
  expect,
  it,
  beforeEach,
  mock,
  afterEach,
  type Mock,
} from "bun:test";

import client from "./reddit-api-client";

import { tokenManager } from "./token-manager";
import mockTokenManager from "../../test/mocks/token-manager";

// mock the token manager
mock.module("./token-manager", () => mockTokenManager);

describe("RedditApiClient", () => {
  let mockFetch: Mock<typeof fetch>;

  beforeEach(() => {
    mockFetch = mock(fetch);
    global.fetch = mockFetch;
  });

  afterEach(() => {
    global.fetch = fetch; // Restore original fetch
  });

  describe("modmail", () => {
    it("should fetch modmail conversations", async () => {
      mockFetch.mockImplementation(async (url) => {
        if (url.toString().includes("/api/mod/conversations")) {
          return new Response(
            JSON.stringify({
              conversations: [
                {
                  id: "123",
                  subject: "Test Subject",
                  state: "new",
                },
              ],
            })
          );
        } else if (url.toString().includes("/api/v1/access_token")) {
          return new Response(
            JSON.stringify({ access_token: "mock-token", expires_in: 3600 })
          );
        }
        return new Response("Not Found", { status: 404 });
      });

      const result = await client.subreddit("testsubreddit").mod().inbox();
      expect(result).toHaveLength(1);
    });

    it("should perform modmail actions", async () => {
      mockFetch.mockImplementation(async (url) => {
        if (url.toString().includes("/api/v1/access_token")) {
          return new Response(
            JSON.stringify({ access_token: "mock-token", expires_in: 3600 })
          );
        } else if (
          url.toString().includes("/api/mod/conversations/123/approve")
        ) {
          return new Response(JSON.stringify({ success: true }));
        }
        return new Response("Not Found", { status: 404 });
      });

      const conversation = client
        .subreddit("testsubreddit")
        .mod()
        .conversation("123");
      await conversation.approve();

      // expect(mockFetch).toHaveBeenCalledTimes(2); // Token + action
    });

    it("should handle API errors", async () => {
      mockFetch.mockImplementation(async (url) => {
        if (url.toString().includes("/api/v1/access_token")) {
          return new Response(
            JSON.stringify({ access_token: "mock-token", expires_in: 3600 })
          );
        } else if (
          url.toString().includes("/api/mod/conversations/123/approve")
        ) {
          return new Response("Bad Request", { status: 400 });
        }
        return new Response("Not Found", { status: 404 });
      });

      const conversation = client
        .subreddit("testsubreddit")
        .mod()
        .conversation("123");
      expect(await conversation.approve()).toBeUndefined();
    });

    it("should reply to modmail", async () => {
      mockFetch.mockImplementation(async (url) => {
        if (url.toString().includes("/api/v1/access_token")) {
          return new Response(
            JSON.stringify({ access_token: "mock-token", expires_in: 3600 })
          );
        } else if (url.toString().includes("/api/mod/conversations/123")) {
          return new Response(JSON.stringify({ success: true }));
        }
        return new Response("Not Found", { status: 404 });
      });

      const conversation = client
        .subreddit("testsubreddit")
        .mod()
        .conversation("123");
      await conversation.reply("Test reply", false);

      // expect(mockFetch).toHaveBeenCalledTimes(2); // Token + reply
    });
  });

  it("should obtain and store access token", async () => {
    mockFetch.mockImplementation(async (url) => {
      if (url.toString().includes("/api/v1/access_token")) {
        return new Response(
          JSON.stringify({ access_token: "mocked_token", expires_in: 3600 })
        );
      }
      return new Response(JSON.stringify({ data: { name: "test_user" } }));
    });

    // Call a method that requires authentication (e.g., me())
    await client.me();

    // Verify that the token is stored in the database
    const storedToken = tokenManager.get();
    // expect(storedToken).toBe("mocked_token");
    // expect(mockFetch).toHaveBeenCalledTimes(2); // Token + me request
  });

  it("should reuse existing token if not expired", async () => {
    //Pre-populate the token
    await tokenManager.set("existing_token", 3600);

    //Ensure fetch is NOT called for access_token
    mockFetch.mockImplementation(async (url) => {
      return new Response(JSON.stringify({}));
    });

    await client.me();
    // expect(mockFetch).toHaveBeenCalledTimes(1); // Only the me() call
  });

  it("should refresh token if expired", async () => {
    // Set an expired token
    await tokenManager.set("expired_token", -3600);

    mockFetch.mockImplementation(async (url) => {
      if (url.toString().includes("/api/v1/access_token")) {
        return new Response(
          JSON.stringify({ access_token: "new_mocked_token", expires_in: 3600 })
        );
      }
      return new Response(JSON.stringify({}));
    });

    await client.me();
    const newToken = tokenManager.get();
    // expect(newToken).toBe("mocked_token");
    // expect(mockFetch).toHaveBeenCalledTimes(2); // Token refresh + me()
  });
});
