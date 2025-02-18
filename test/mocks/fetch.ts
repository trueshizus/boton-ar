import { mock } from "bun-bagel";
import setupMockRedditApi from "./reddit-api";

const mockFetch = (input: RequestInfo | URL, init?: RequestInit) => {
  setupMockRedditApi();

  mock("/*", {
    response: {
      status: 501,
      data: { message: "GET endpoint not mocked" },
    },
  });

  mock("/*", {
    method: "POST",
    response: {
      status: 200,
      data: { message: "POST endpoint not mocked" },
    },
  });

  return fetch(input, init);
};

export default mockFetch;
