const Joi = require("joi");

const ORDER_STATUSES = ["pending", "confirmed", "shipped", "delivered", "cancelled", "returned"];

// One CSV row. "order_amout" (typo in the spec) is accepted as an alias.
const orderRowSchema = Joi.object({
  order_id: Joi.string().trim().max(64).pattern(/^[A-Za-z0-9_-]+$/).required(),
  customer_id: Joi.string().trim().max(64).required(),
  order_date: Joi.date().iso().required(),
  order_amount: Joi.number().min(0).max(9999999999.99).precision(2).required(),
  status: Joi.string().trim().lowercase().valid(...ORDER_STATUSES).required(),
}).rename("order_amout", "order_amount", { ignoreUndefined: true });

const validateOrderRow = (row) => {
  const { value, error } = orderRowSchema.validate(row, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    return { error: error.details.map((detail) => detail.message).join("; ") };
  }

  return { value };
};

const orderIdParamsSchema = Joi.object({
  orderId: Joi.string().trim().max(64).required(),
});

// Optional: if customerId is known, only its shard is queried
const orderLookupQuerySchema = Joi.object({
  customerId: Joi.string().trim().max(64),
});

const listOrdersQuerySchema = Joi.object({
  customerId: Joi.string().trim().max(64).required(),
  limit: Joi.number().integer().min(1).max(500).default(50),
  offset: Joi.number().integer().min(0).default(0),
});

const uploadIdParamsSchema = Joi.object({
  uploadId: Joi.string().guid().required(),
});

module.exports = {
  ORDER_STATUSES,
  validateOrderRow,
  orderIdParamsSchema,
  orderLookupQuerySchema,
  listOrdersQuerySchema,
  uploadIdParamsSchema,
};
