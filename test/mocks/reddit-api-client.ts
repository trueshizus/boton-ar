export const mockClient = (credentials: any) => ({
  subreddit: (name: string) => ({
    about: () =>
      Promise.resolve({
        displayName: `Mock ${name}`,
        subscribers: 100,
        description: "Mock Description",
      }),
    config: () => Promise.resolve({ allowImages: true, submissionType: "any" }),
    queue: (queueName: string) => ({
      posts: () =>
        Promise.resolve([
          {
            id: "post1",
            title: "Mock Post 1",
            author: "user1",
            score: 10,
            url: "/r/mock/post1",
          },
          {
            id: "post2",
            title: "Mock Post 2",
            author: "user2",
            score: 5,
            url: "/r/mock/post2",
          },
        ]),
      post: (postId: string) =>
        Promise.resolve({
          id: postId,
          title: `Mock Post ${postId}`,
          selftext: "Mock Post Content",
        }),
    }),
    inbox: () => ({
      conversations: () =>
        Promise.resolve([
          { subject: "Mock Convo 1", lastMessage: { author: "user3" } },
          { subject: "Mock Convo 2", lastMessage: { author: "user4" } },
        ]),
      conversation: (conversationId: string) =>
        Promise.resolve({
          messages: [
            `Mock Message 1 in ${conversationId}`,
            `Mock Message 2 in ${conversationId}`,
          ],
        }),
    }),
    mod: () => ({
      approve: (id: string) => Promise.resolve({ success: true }),
      remove: (id: string) => Promise.resolve({ success: true }),
      block: (id: string) => Promise.resolve({ success: true }),
      modqueue: () => ({
        posts: () =>
          Promise.resolve([
            {
              id: "modqueue1",
              title: "Modqueue Post 1",
              author: "user5",
              score: 2,
              url: "/r/mock/modqueue1",
            },
          ]),
      }),
      unmoderated: () => ({
        posts: () =>
          Promise.resolve([
            {
              id: "unmoderated1",
              title: "Unmoderated Post 1",
              author: "user6",
              score: 8,
              url: "/r/mock/unmoderated1",
            },
          ]),
      }),
    }),
  }),
  me: () => Promise.resolve({ name: "MockUser", karma: 1000 }),
});
