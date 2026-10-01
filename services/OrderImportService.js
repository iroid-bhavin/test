const fs = require("fs");
const { parse } = require("csv-parse");
const { shards } = require("../config/connection");
const OrderModel = require("../models/OrderModel");
const UploadModel = require("../models/UploadModel");
const { validateOrderRow } = require("../validations/OrderValidation");
const { getShardIndex } = require("../utils/ShardRouter");
const { withRetry } = require("../utils/Retry");
const logger = require("../utils/Logger");

const BATCH_SIZE = Number(process.env.BATCH_SIZE) || 500;

// Reads the CSV row by row, validates, and writes batches to the right shard.
// Only one batch per shard is held in memory at a time.
const importOrders = async (filePath, uploadId) => {
  const stats = { total: 0, inserted: 0, duplicates: 0, failed: 0 };
  const shardBatches = shards.map(() => []);
  let failedBatch = [];

  const saveFailedRows = async () => {
    const rows = failedBatch;
    failedBatch = [];
    await withRetry(() => UploadModel.insertFailedRows(uploadId, rows), { label: "save failed rows" });
  };

  const markFailed = (rowNumber, raw, reason) => {
    stats.failed++;
    failedBatch.push({ rowNumber, raw, reason });
    logger.warn("Order row rejected", { uploadId, rowNumber, reason });
  };

  const flushShard = async (shardIndex) => {
    const batch = shardBatches[shardIndex];
    shardBatches[shardIndex] = [];
    if (batch.length === 0) return;

    try {
      const inserted = await withRetry(() => OrderModel.insertBatch(shardIndex, batch, uploadId), {
        label: `insert batch into shard ${shardIndex}`,
      });
      stats.inserted += inserted;
      stats.duplicates += batch.length - inserted;
    } catch (error) {
      // Batch gave up after retries: keep the rows instead of losing them
      logger.error("Batch insert failed", { uploadId, shard: shardIndex, rows: batch.length, error: error.message });
      batch.forEach((order) => markFailed(order.rowNumber, order, `Database insert failed: ${error.message}`));
    }
  };

  const parser = fs.createReadStream(filePath).pipe(
    parse({
      columns: (header) => header.map((column) => column.trim().toLowerCase()),
      trim: true,
      skip_empty_lines: true,
      relax_column_count: true,
      bom: true,
    })
  );

  // for await pauses the stream while a batch is being written (backpressure)
  for await (const raw of parser) {
    stats.total++;
    const rowNumber = stats.total + 1; // line 1 is the header

    const { value, error } = validateOrderRow(raw);
    if (error) {
      markFailed(rowNumber, raw, error);
    } else {
      const shardIndex = getShardIndex(value.customer_id, shards.length);
      shardBatches[shardIndex].push({ ...value, rowNumber });

      if (shardBatches[shardIndex].length >= BATCH_SIZE) await flushShard(shardIndex);
    }

    if (failedBatch.length >= BATCH_SIZE) await saveFailedRows();
  }

  await Promise.all(shardBatches.map((_, shardIndex) => flushShard(shardIndex)));
  await saveFailedRows();

  return stats;
};

// Background job: runs after the API has already answered the client
const processUpload = async ({ uploadId, filePath }) => {
  const startedAt = Date.now();
  logger.info("Processing started", { uploadId });

  try {
    await UploadModel.update(uploadId, { status: UploadModel.UPLOAD_STATUS.PROCESSING });

    const stats = await importOrders(filePath, uploadId);

    await UploadModel.update(uploadId, {
      status: UploadModel.UPLOAD_STATUS.COMPLETED,
      total_rows: stats.total,
      inserted_rows: stats.inserted,
      duplicate_rows: stats.duplicates,
      failed_rows: stats.failed,
    });

    logger.info("Processing finished", { uploadId, ...stats, durationMs: Date.now() - startedAt });
  } catch (error) {
    logger.error("Processing failed", { uploadId, error: error.message });
    await UploadModel.update(uploadId, {
      status: UploadModel.UPLOAD_STATUS.FAILED,
      error: error.message,
    }).catch(() => {});
  } finally {
    fs.promises.unlink(filePath).catch(() => {});
  }
};

module.exports = { importOrders, processUpload };
