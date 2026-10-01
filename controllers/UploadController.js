const crypto = require("crypto");
const fs = require("fs");
const UploadModel = require("../models/UploadModel");
const StorageService = require("../services/StorageService");
const ImportQueue = require("../jobs/ImportQueue");
const logger = require("../utils/Logger");

const uploadOrders = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: "Orders file is required (form field name: 'file')",
    });
  }

  const uploadId = crypto.randomUUID();
  const { originalname, path: filePath, size } = req.file;

  try {
    await UploadModel.create({ id: uploadId, fileName: originalname });
  } catch (error) {
    logger.error("Could not create upload record", { error: error.message });
    fs.promises.unlink(filePath).catch(() => {});
    return res.status(500).json({ success: false, message: "Internal server error" });
  }

  logger.info("GCS upload started", { uploadId, fileName: originalname, size });

  let gcsUri;
  try {
    gcsUri = await StorageService.uploadFile(filePath, `orders/${uploadId}/${originalname}`);
    logger.info("GCS upload finished", { uploadId, gcsUri });
  } catch (error) {
    logger.error("GCS upload failed", { uploadId, error: error.message });
    await UploadModel.update(uploadId, {
      status: UploadModel.UPLOAD_STATUS.FAILED,
      error: `GCS upload failed: ${error.message}`,
    }).catch(() => {});
    fs.promises.unlink(filePath).catch(() => {});

    return res.status(502).json({
      success: false,
      message: "File could not be uploaded to cloud storage",
      uploadId,
    });
  }

  await UploadModel.update(uploadId, { status: UploadModel.UPLOAD_STATUS.QUEUED, gcs_uri: gcsUri });
  ImportQueue.enqueue({ uploadId, filePath });

  return res.status(202).json({
    success: true,
    message: "File uploaded, processing started",
    data: {
      uploadId,
      status: UploadModel.UPLOAD_STATUS.QUEUED,
      gcsUri,
      statusUrl: `/uploads/${uploadId}`,
    },
  });
};

const getUploadStatus = async (req, res) => {
  try {
    const { uploadId } = req.validated;
    const upload = await UploadModel.findById(uploadId);

    if (!upload) {
      return res.status(404).json({ success: false, message: "Upload not found" });
    }

    const failedRows = upload.failed_rows > 0 ? await UploadModel.findFailedRows(uploadId) : [];

    return res.status(200).json({
      success: true,
      data: { ...upload, failed_row_samples: failedRows },
    });
  } catch (error) {
    logger.error("Get upload status error", { error: error.message });
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

module.exports = {
  uploadOrders,
  getUploadStatus,
};
