const { processUpload } = require("../services/OrderImportService");
const logger = require("../utils/Logger");

// Simple in-process queue: one file at a time so the DB is not flooded.
// Can be swapped for Cloud Tasks / Pub/Sub / BullMQ without touching the controller.
const queue = [];
let isRunning = false;

const runNext = async () => {
  if (isRunning || queue.length === 0) return;

  isRunning = true;
  const job = queue.shift();

  try {
    await processUpload(job);
  } catch (error) {
    logger.error("Import job crashed", { uploadId: job.uploadId, error: error.message });
  } finally {
    isRunning = false;
    runNext();
  }
};

const enqueue = (job) => {
  queue.push(job);
  logger.info("Import job queued", { uploadId: job.uploadId, waiting: queue.length });
  runNext();
};

const size = () => queue.length + (isRunning ? 1 : 0);

module.exports = { enqueue, size };
