const multer = require("multer");
const logger = require("../utils/Logger");

const notFound = (req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
};

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    const message =
      err.code === "LIMIT_UNEXPECTED_FILE"
        ? "Only a single .csv file in the 'file' field is allowed"
        : err.message;
    return res.status(400).json({ success: false, message });
  }

  logger.error("Unhandled error", { path: req.path, error: err.message });
  res.status(500).json({ success: false, message: "Internal server error" });
};

module.exports = { notFound, errorHandler };
