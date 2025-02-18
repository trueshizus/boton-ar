import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
  spyOn,
  mock,
} from "bun:test";
import createRedditClient from "./reddit-api-client";

mock.module("./token-manager", () => {
  return {
    tokenManager: {
      get: jest.fn(),
      set: jest.fn(),
      clear: jest.fn(),
    },
  };
});

describe("Reddit API Client Interface Tests", () => {
  const client = createRedditClient();

  const subreddit = client.subreddit("AskArgentina");

  describe("1. Fetching Basic Subreddit Information", () => {
    it("should get general information", async () => {
      const about = await subreddit.about();
      expect(about.description).toBe("not_implemented");
    });

    it("should get configuration", async () => {
      const config = await subreddit.config();

      expect(config.description).toBe("not_implemented");
    });
  });

  describe.skip("2. Browsing Posts in Different Queues", () => {
    it("should get posts from the main queue", async () => {
      const mainQueue = await subreddit.queue("main");
      const posts = await mainQueue.posts();
    });

    it("should get a specific post by ID", async () => {
      const mainQueue = await subreddit.queue("main");
      const post = await mainQueue.post("post_id_123");
    });

    it("should get posts from the modqueue", async () => {
      const modqueue = await subreddit.queue("modqueue");
      const posts = await modqueue.posts();

      expect(global.fetch).toHaveBeenCalledWith(
        "https://oauth.reddit.com/r/AskArgentina/about/modqueue",
        {
          method: "GET",
          headers: {
            Authorization: "Bearer mocked_token",
            "User-Agent": expect.any(String),
          },
          body: undefined,
        }
      );
    });
  });

  describe("3. Interacting with the Inbox", () => {
    it("should list conversations", async () => {
      const inbox = await subreddit.inbox();
      // const conversations = await inbox.conversations();
    });

    it("should get a specific conversation", async () => {
      const inbox = await subreddit.inbox();
      const conversation = await inbox.conversation("conversation_id_456");
    });
  });

  describe("4. Performing Moderation Actions", () => {
    let mod: any;

    beforeEach(() => {
      mod = subreddit.mod();
    });

    it("should approve a post", async () => {
      const result = await mod.approve("post_id_789");
      // expect(result.success).toBe(true);
      // TODO: Implement this
    });

    it("should remove a post", async () => {
      const result = await mod.remove("post_id_abc");
      // expect(result.success).toBe(true);
      // TODO: Implement this
    });

    it("should block a user", async () => {
      const result = await mod.block("user_xyz");
      // expect(result.success).toBe(true);
      // TODO: Implement this
    });

    it("should get modqueue posts", async () => {
      const modqueue = await mod.modqueue();
      const posts = await modqueue.posts();
      // expect(posts.length).toBe(1);
      // expect(posts[0].title).toBe("Modqueue Post 1");
      // TODO: Implement this
    });

    it("should get unmoderated posts", async () => {
      const unmoderated = await mod.unmoderated();
      // TODO: Implement this
    });
  });

  describe("5. Getting Current User Information", () => {
    it("should get user info", async () => {
      const me = await client.me();
      expect(me.name).toBe("BotonAr");
    });
  });

  describe("6. Combining Actions (Example)", () => {
    it("should approve a post from modqueue based on title", async () => {
      const mod = subreddit.mod();
      const modqueue = await mod.modqueue();
      const posts = await modqueue.posts();

      const approveSpy = spyOn(mod, "approve");

      // for (const post of posts) {
      //   if (post.title.includes("Important Topic")) {
      //     await mod.approve(post.id);
      //     expect(approveSpy).toHaveBeenCalledWith(post.id);
      //   }
      // }
      // approveSpy.mockRestore();
    });
  });

  describe("7. Error Handling", () => {
    it("should handle errors when fetching subreddit info", async () => {
      try {
        await subreddit.about();
      } catch (error: any) {
        expect(error.message).toBe("API Error (500): Internal Server Error");
      }
    });

    it("should handle token expiration (401)", async () => {
      const about = await subreddit.about();
      expect(about.description).toBe("not_implemented");
    });
  });
});
