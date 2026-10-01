const logger = require("./Logger");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Retries with exponential backoff: 200ms, 400ms, 800ms...
const withRetry = async (work, { retries = 3, delayMs = 200, label = "operation" } = {}) => {
  for (let attempt = 1; ; attempt++) {
    try {
      return await work();
    } catch (error) {
      if (attempt > retries) throw error;
      logger.warn(`${label} failed, retrying`, { attempt, error: error.message });
      await sleep(delayMs * 2 ** (attempt - 1));
    }
  }
};

module.exports = { withRetry };
