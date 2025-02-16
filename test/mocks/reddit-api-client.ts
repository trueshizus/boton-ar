import { mock } from "bun:test";
import me from "../fixtures/me.json";
import modqueue from "../fixtures/modqueue.json";

export default () => ({
  default: {
    me: mock(async () => me),
    approve: mock(async () => ({})),
    remove: mock(async () => ({})),
    subreddit: mock((subredditName: string) => ({
      listing: async () => ({
        kind: "Listing",
        data: {
          after: null,
          children: [],
        },
      }),
      modqueue: async () => modqueue,
    })),
  },
});
