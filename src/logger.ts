// ./src/logger.ts
import adze, { setup } from "adze";

setup({
  meta: {
    hello: "world!",
  },
});

const logger = adze.withEmoji.timestamp.seal();
export default logger;
