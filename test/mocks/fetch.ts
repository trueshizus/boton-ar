import { mock } from "bun-bagel";
import setupMockRedditApi from "./reddit-api";

const mockFetch = (input: RequestInfo | URL, init?: RequestInit) => {
  setupMockRedditApi();

  mock("/*", {
    response: {
      status: 501,
      data: "Not mocked yet",
    },
  });

  mock("/*", {
    method: "POST",
    response: {
      status: 200,
      data: "test",
    },
  });

  return fetch(input, init);
};

export default mockFetch;
