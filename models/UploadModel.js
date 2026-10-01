const { Upload, FailedRow } = require("../config/connection");

const UPLOAD_STATUS = {
  UPLOADING: "uploading",
  QUEUED: "queued",
  PROCESSING: "processing",
  COMPLETED: "completed",
  FAILED: "failed",
};

const create = async ({ id, fileName }) => {
  const upload = await Upload.create({ id, file_name: fileName, status: UPLOAD_STATUS.UPLOADING });
  return upload.get({ plain: true });
};

// fields: any of status, gcs_uri, total_rows, inserted_rows, duplicate_rows, failed_rows, error
// updated_at is set by Sequelize
const update = async (id, fields) => {
  const [, rows] = await Upload.update(fields, { where: { id }, returning: true });
  return rows[0] ? rows[0].get({ plain: true }) : undefined;
};

const findById = (id) => Upload.findByPk(id, { raw: true });

const insertFailedRows = async (uploadId, failedRows) => {
  if (failedRows.length === 0) return;

  await FailedRow.bulkCreate(
    failedRows.map((row) => ({
      upload_id: uploadId,
      row_number: row.rowNumber,
      raw_data: row.raw,
      reason: row.reason,
    })),
    { returning: false }
  );
};

const findFailedRows = (uploadId, limit = 100) =>
  FailedRow.findAll({
    attributes: ["row_number", "raw_data", "reason"],
    where: { upload_id: uploadId },
    order: [["row_number", "ASC"]],
    limit,
    raw: true,
  });

module.exports = {
  UPLOAD_STATUS,
  create,
  update,
  findById,
  insertFailedRows,
  findFailedRows,
};
