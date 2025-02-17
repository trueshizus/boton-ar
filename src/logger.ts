// ./src/logger.ts
import adze, { setup } from "adze";

setup();

const logger = adze.withEmoji.timestamp.seal();
export default logger;
