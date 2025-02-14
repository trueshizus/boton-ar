import { serve } from "bun";
import { router } from "./api/routes";

console.log("Starting server on port 3000...");

serve({
  fetch: async (request: Request) => {
    try {
      const url = new URL(request.url);
      if (url.pathname.startsWith("/api")) {
        // Delegate API requests to our router
        return await router.handle(request);
      }
      // Default response for non-API routes
      return new Response("Welcome to the Reddit Moderation Tracker", {
        status: 200,
      });
    } catch (err) {
      console.error("Error handling request:", err);
      return new Response("Internal Server Error", { status: 500 });
    }
  },
  port: 3000,
});
