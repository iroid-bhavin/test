const express = require("express");
const router = express.Router();
const validate = require("../middleware/JoiValidation");
const uploadFile = require("../middleware/Upload");
const { uploadIdParamsSchema } = require("../validations/OrderValidation");
const { uploadOrders, getUploadStatus } = require("../controllers/UploadController");

// POST /upload-orders (multipart/form-data, field "file")
router.post("/upload-orders", uploadFile, uploadOrders);

// GET /uploads/:uploadId
router.get("/uploads/:uploadId", validate(uploadIdParamsSchema, "params"), getUploadStatus);

module.exports = router;
