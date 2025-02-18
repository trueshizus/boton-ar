import { Hono } from "hono";
import type { FC } from "hono/jsx";
import { eq, sql } from "drizzle-orm";
import db from "./db";
import {
  trackedSubredditsTable,
  modqueueItemsTable,
  commentsTable,
} from "./db/schema";

const app = new Hono();

type DashboardData = {
  subreddits: {
    name: string;
    isActive: boolean;
    modqueueCount: number;
    recentComments: number;
  }[];
  totalModqueueItems: number;
  totalComments: number;
  queueStats: {
    pendingTasks: number;
    processingTasks: number;
    lastProcessed: string;
  };
  scheduledTasks: {
    name: string;
    nextRun: string;
    lastRun: string;
    status: "active" | "failed" | "completed";
  }[];
  workerStatus: {
    isRunning: boolean;
    queueSize: number;
    lastStarted: string | null;
  };
};

const Layout: FC = (props) => {
  return (
    <html>
      <head>
        <title>BotonAr Dashboard</title>
        <script src="https://cdn.tailwindcss.com"></script>
      </head>
      <body class="bg-gray-100">
        <div class="container mx-auto px-4 py-8">{props.children}</div>
      </body>
    </html>
  );
};

const Dashboard: FC<{ data: DashboardData }> = ({ data }) => {
  return (
    <Layout>
      <div class="mb-8">
        <h1 class="text-3xl font-bold text-gray-800 mb-4">
          Moderation Dashboard
        </h1>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="bg-white p-4 rounded-lg shadow">
            <h2 class="text-xl font-semibold mb-2">Overview</h2>
            <div class="grid grid-cols-2 gap-4">
              <div class="border p-4 rounded">
                <p class="text-sm text-gray-600">Total in Modqueue</p>
                <p class="text-2xl font-bold">{data.totalModqueueItems}</p>
              </div>
              <div class="border p-4 rounded">
                <p class="text-sm text-gray-600">Total Comments</p>
                <p class="text-2xl font-bold">{data.totalComments}</p>
              </div>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div class="bg-white p-4 rounded-lg shadow">
            <h2 class="text-xl font-semibold mb-2">Queue Status</h2>
            <div class="grid grid-cols-3 gap-4">
              <div class="border p-4 rounded">
                <p class="text-sm text-gray-600">Pending Tasks</p>
                <p class="text-2xl font-bold">{data.queueStats.pendingTasks}</p>
              </div>
              <div class="border p-4 rounded">
                <p class="text-sm text-gray-600">Processing</p>
                <p class="text-2xl font-bold">
                  {data.queueStats.processingTasks}
                </p>
              </div>
              <div class="border p-4 rounded">
                <p class="text-sm text-gray-600">Last Processed</p>
                <p class="text-sm font-medium">
                  {data.queueStats.lastProcessed}
                </p>
              </div>
            </div>
          </div>

          <div class="bg-white p-4 rounded-lg shadow">
            <h2 class="text-xl font-semibold mb-2">Scheduled Tasks</h2>
            <div class="space-y-2">
              {data.scheduledTasks.map((task) => (
                <div class="border p-2 rounded">
                  <div class="flex justify-between items-center">
                    <span class="font-medium">{task.name}</span>
                    <span
                      class={`px-2 py-1 rounded text-sm ${
                        task.status === "active"
                          ? "bg-green-100 text-green-800"
                          : task.status === "failed"
                          ? "bg-red-100 text-red-800"
                          : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {task.status}
                    </span>
                  </div>
                  <div class="text-sm text-gray-600 mt-1">
                    <div>Next run: {task.nextRun}</div>
                    <div>Last run: {task.lastRun}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div class="bg-white p-4 rounded-lg shadow">
            <div class="flex justify-between items-center mb-4">
              <h2 class="text-xl font-semibold">Worker Controls</h2>
              <span
                class={`px-3 py-1 rounded-full text-sm ${
                  data.workerStatus.isRunning
                    ? "bg-green-100 text-green-800"
                    : "bg-red-100 text-red-800"
                }`}
              >
                {data.workerStatus.isRunning ? "Running" : "Stopped"}
              </span>
            </div>
            <div class="space-y-2">
              <div class="text-sm text-gray-600">
                Queue size: {data.workerStatus.queueSize}
                {data.workerStatus.lastStarted && (
                  <div>
                    Last started:{" "}
                    {new Date(data.workerStatus.lastStarted).toLocaleString()}
                  </div>
                )}
              </div>
              <div class="flex gap-2 mt-4">
                <form action="/worker/start">
                  <button
                    class="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                    disabled={data.workerStatus.isRunning}
                  >
                    Start Worker
                  </button>
                </form>
                <form action="/worker/stop">
                  <button
                    class="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                    disabled={!data.workerStatus.isRunning}
                  >
                    Stop Worker
                  </button>
                </form>
                <form
                  action="/queue/clear"
                  onsubmit="return confirm('Are you sure you want to clear the queue?')"
                >
                  <button class="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700">
                    Clear Queue
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="bg-white p-6 rounded-lg shadow">
        <h2 class="text-xl font-semibold mb-4">Tracked Subreddits</h2>
        <div class="overflow-x-auto">
          <table class="min-w-full table-auto">
            <thead>
              <tr class="bg-gray-50">
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Subreddit
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Status
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Modqueue Items
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Recent Comments
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200">
              {data.subreddits.map((sub) => (
                <tr>
                  <td class="px-6 py-4">
                    <a
                      href={`/r/${sub.name}`}
                      class="text-blue-600 hover:text-blue-800"
                    >
                      r/{sub.name}
                    </a>
                  </td>
                  <td class="px-6 py-4">
                    <span
                      class={`px-2 py-1 rounded text-sm ${
                        sub.isActive
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {sub.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td class="px-6 py-4">{sub.modqueueCount}</td>
                  <td class="px-6 py-4">{sub.recentComments}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
};

app.get("/", async (c) => {
  // Get all tracked subreddits
  const subreddits = await db.select().from(trackedSubredditsTable);

  // Get modqueue counts and recent comments for each subreddit
  const dashboardData: DashboardData = {
    subreddits: await Promise.all(
      subreddits.map(async (sub) => {
        const [modqueueCount] = await db
          .select({ count: sql<number>`COUNT(*)` })
          .from(modqueueItemsTable)
          .where(eq(modqueueItemsTable.subreddit, sub.subreddit));

        const [commentsCount] = await db
          .select({ count: sql<number>`COUNT(*)` })
          .from(commentsTable)
          .where(eq(commentsTable.subreddit, sub.subreddit));

        return {
          name: sub.subreddit,
          isActive: sub.is_active,
          modqueueCount: Number(modqueueCount.count),
          recentComments: Number(commentsCount.count),
        };
      })
    ),
    totalModqueueItems: 0,
    totalComments: 0,
    queueStats: {
      pendingTasks: 0, // Replace with actual queue stats
      processingTasks: 0,
      lastProcessed: new Date().toISOString(),
    },
    scheduledTasks: [
      {
        name: "Modqueue Sync",
        nextRun: new Date(Date.now() + 300000).toISOString(), // +5 minutes
        lastRun: new Date().toISOString(),
        status: "active",
      },
      {
        name: "Comment Cleanup",
        nextRun: new Date(Date.now() + 3600000).toISOString(), // +1 hour
        lastRun: new Date().toISOString(),
        status: "completed",
      },
      // Add more scheduled tasks as needed
    ],
    workerStatus: {
      isRunning: true, // Replace with actual worker status
      queueSize: 42, // Replace with actual queue size
      lastStarted: new Date().toISOString(),
    },
  };

  // Calculate totals
  dashboardData.totalModqueueItems = dashboardData.subreddits.reduce(
    (acc, sub) => acc + sub.modqueueCount,
    0
  );
  dashboardData.totalComments = dashboardData.subreddits.reduce(
    (acc, sub) => acc + sub.recentComments,
    0
  );

  return c.html(<Dashboard data={dashboardData} />);
});

// Add new endpoints for worker control
app.post("/worker/start", async (c) => {
  // Add logic to start the worker
  return c.redirect("/");
});

app.post("/worker/stop", async (c) => {
  // Add logic to stop the worker
  return c.redirect("/");
});

app.post("/queue/clear", async (c) => {
  // Add logic to clear the queue
  return c.redirect("/");
});

export default app;
