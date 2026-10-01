const { shards, getShard } = require("../config/connection");

const ORDER_ATTRIBUTES = ["order_id", "customer_id", "order_date", "order_amount", "status", "upload_id", "created_at"];

// One multi-row INSERT ... ON CONFLICT (order_id) DO NOTHING per batch, so
// re-uploading the same file is safe (idempotent).
// Returns the number of new rows (duplicates are skipped)
const insertBatch = (shardIndex, orders, uploadId) => {
  const { sequelize, Order } = shards[shardIndex];
  const now = new Date();

  const records = orders.map((order) => ({
    order_id: order.order_id,
    customer_id: order.customer_id,
    order_date: order.order_date,
    order_amount: order.order_amount,
    status: order.status,
    upload_id: uploadId,
    created_at: now,
  }));

  // Model.bulkCreate returns every instance, even skipped ones, so the query
  // interface is used here: RETURNING gives back only the rows really inserted
  return sequelize.transaction(async (transaction) => {
    const inserted = await sequelize
      .getQueryInterface()
      .bulkInsert(
        Order.getTableName(),
        records,
        { transaction, ignoreDuplicates: true, returning: ["order_id"] },
        Order.getAttributes()
      );
    return inserted.length;
  });
};

// Without customerId we don't know the shard, so all shards are asked in parallel
const findById = async (orderId, customerId) => {
  const targets = customerId ? [getShard(customerId)] : shards;

  const results = await Promise.all(
    targets.map(({ Order }) => Order.findByPk(orderId, { attributes: ORDER_ATTRIBUTES, raw: true }))
  );

  return results.find(Boolean) || null;
};

// customer_id is the shard key, so this hits exactly one shard
const findByCustomer = (customerId, limit, offset) =>
  getShard(customerId).Order.findAll({
    attributes: ORDER_ATTRIBUTES,
    where: { customer_id: customerId },
    order: [["order_date", "DESC"]],
    limit,
    offset,
    raw: true,
  });

module.exports = {
  insertBatch,
  findById,
  findByCustomer,
};
