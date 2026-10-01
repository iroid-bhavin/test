const { DataTypes } = require("sequelize");

module.exports = (sequelize) =>
  sequelize.define(
    "Upload",
    {
      id: { type: DataTypes.UUID, primaryKey: true },
      file_name: { type: DataTypes.TEXT, allowNull: false },
      gcs_uri: { type: DataTypes.TEXT },
      status: { type: DataTypes.STRING(20), allowNull: false },
      total_rows: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      inserted_rows: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      duplicate_rows: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      failed_rows: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      error: { type: DataTypes.TEXT },
    },
    {
      tableName: "uploads",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
    }
  );
