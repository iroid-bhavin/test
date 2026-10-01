const { DataTypes } = require("sequelize");

// Invalid rows are kept here so they can be reviewed and fixed later
module.exports = (sequelize) =>
  sequelize.define(
    "FailedRow",
    {
      id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
      upload_id: { type: DataTypes.UUID, allowNull: false },
      row_number: { type: DataTypes.INTEGER, allowNull: false },
      raw_data: { type: DataTypes.JSONB, allowNull: false },
      reason: { type: DataTypes.TEXT, allowNull: false },
    },
    {
      tableName: "failed_rows",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: false,
      indexes: [{ name: "idx_failed_rows_upload", fields: ["upload_id", "row_number"] }],
    }
  );
