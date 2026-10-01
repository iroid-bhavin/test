const express = require("express");
const router = express.Router();
const validate = require("../middleware/JoiValidation");
const {
  orderIdParamsSchema,
  orderLookupQuerySchema,
  listOrdersQuerySchema,
} = require("../validations/OrderValidation");
const { getOrderById, getOrdersByCustomer } = require("../controllers/OrderController");

// GET /orders?customerId=CUST-0001&limit=50&offset=0
router.get("/", validate(listOrdersQuerySchema, "query"), getOrdersByCustomer);

// GET /orders/:orderId
router.get(
  "/:orderId",
  validate(orderIdParamsSchema, "params"),
  validate(orderLookupQuerySchema, "query"),
  getOrderById
);

module.exports = router;
