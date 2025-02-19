import { Hono } from "hono";
import reset from "./reset";
import me from "./me";
import subreddits from "./subreddits";

const app = new Hono();

app.route("/reset", reset);
app.route("/me", me);
app.route("/subreddits", subreddits);

export default app;
