const { DataTypes } = require("sequelize");

module.exports = (sequelize) =>
  sequelize.define(
    "Order",
    {
      order_id: { type: DataTypes.STRING(64), primaryKey: true },
      customer_id: { type: DataTypes.STRING(64), allowNull: false },
      order_date: { type: DataTypes.DATE, allowNull: false },
      // DECIMAL keeps money exact; pg returns it as a string
      order_amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, validate: { min: 0 } },
      status: { type: DataTypes.STRING(20), allowNull: false },
      upload_id: { type: DataTypes.UUID },
    },
    {
      tableName: "orders",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: false,
      indexes: [
        // Customer order history, newest first
        {
          name: "idx_orders_customer_date",
          fields: ["customer_id", { name: "order_date", order: "DESC" }],
        },
        // Date range reports
        { name: "idx_orders_order_date", fields: ["order_date"] },
      ],
    }
  );
