const os = require("os");
const path = require("path");
const multer = require("multer");

const MAX_FILE_SIZE_MB = Number(process.env.MAX_FILE_SIZE_MB) || 50;

// Saved to a temp file on disk, never kept in memory
const upload = multer({
  dest: path.join(os.tmpdir(), "order-uploads"),
  limits: { fileSize: MAX_FILE_SIZE_MB * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const isCsv = path.extname(file.originalname).toLowerCase() === ".csv";
    cb(isCsv ? null : new multer.MulterError("LIMIT_UNEXPECTED_FILE", "file"), isCsv);
  },
});

module.exports = upload.single("file");
