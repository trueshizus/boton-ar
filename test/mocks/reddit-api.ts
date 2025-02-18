import { mock, type MockOptions } from "bun-bagel";
import accessTokenFixture from "../fixtures/access_token.json";
import meMock from "../fixtures/me.json";
import aboutMock from "../fixtures/about.json";
import modqueueMock from "../fixtures/modqueue.json";

// Mock API endpoints with empty responses

const options: MockOptions = {
  method: "GET",
  response: {
    data: { description: "not_implemented" },
  },
};

const optionsPost: MockOptions = {
  method: "POST",
  response: {
    data: { description: "not_implemented" },
  },
};

const mockEndpoints = [
  // Auth
  "https://www.reddit.com/api/v1/access_token",

  // User info
  "/api/v1/me",

  // Subreddit info
  "/r/:subreddit/about",
  "/r/:subreddit/api/site_admin",

  // Queues
  "/r/:subreddit/new",

  "/r/:subreddit/about/modqueue",
  "/r/:subreddit/about/removed",
  "/r/:subreddit/about/contributors",
  "/r/:subreddit/comments/:postId",
  "/r/:subreddit/about/unmoderated",

  // Moderation actions
  "/api/approve",
  "/api/remove",
  "/r/:subreddit/api/block_user",

  // Inbox/Modmail
  "https://oauth.reddit.com/api/mod/conversations/conversation_id_456",
  "https://oauth.reddit.com/api/mod/conversations",
  "https://oauth.reddit.com/api/mod/conversations/:conversationId",
  "https://oauth.reddit.com/r/AskArgentina/api/site_admin",
];

const mockRedditApi = () => {
  mock("https://www.reddit.com/api/v1/access_token", {
    response: {
      status: 200,
      data: accessTokenFixture,
    },
  });
  mock("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    response: {
      status: 200,
      data: accessTokenFixture,
    },
  });

  mock("https://oauth.reddit.com/r/AskArgentina/about", {
    response: {
      status: 200,
      data: aboutMock,
    },
  });

  mock("https://oauth.reddit.com/r/AskArgentina/about/modqueue", {
    response: {
      status: 200,
      data: modqueueMock,
    },
  });

  mock("https://oauth.reddit.com/r/testsubreddit/about/modqueue", {
    response: {
      status: 200,
      data: modqueueMock,
    },
  });

  mock("https://oauth.reddit.com/r/AskArgentina/api/site_admin", {
    response: {
      status: 200,
      data: {},
    },
  });

  mock("https://oauth.reddit.com/api/v1/me", {
    response: {
      status: 200,
      data: meMock,
    },
  });

  mock("https://oauth.reddit.com/r/AskArgentina/about/unmoderated", {
    response: {
      status: 200,
      data: {
        data: {
          children: [],
        },
      },
    },
  });

  mock("https://oauth.reddit.com/api/mod/conversations", {
    response: {
      status: 200,
      data: {
        data: {
          children: [
            {
              data: {
                id: "123",
              },
            },
          ],
        },
      },
    },
  });

  mockEndpoints.forEach((endpoint) => {
    mock(endpoint, options);
    mock(endpoint, optionsPost);
  });
};

export default mockRedditApi;
