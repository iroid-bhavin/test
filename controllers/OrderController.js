const OrderModel = require("../models/OrderModel");
const logger = require("../utils/Logger");

const getOrderById = async (req, res) => {
  try {
    const { orderId, customerId } = req.validated;
    const order = await OrderModel.findById(orderId, customerId);

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    return res.status(200).json({ success: true, data: order });
  } catch (error) {
    logger.error("Get order error", { error: error.message });
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const getOrdersByCustomer = async (req, res) => {
  try {
    const { customerId, limit, offset } = req.validated;
    const orders = await OrderModel.findByCustomer(customerId, limit, offset);

    return res.status(200).json({
      success: true,
      count: orders.length,
      pagination: { limit, offset },
      data: orders,
    });
  } catch (error) {
    logger.error("Get customer orders error", { error: error.message });
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

module.exports = {
  getOrderById,
  getOrdersByCustomer,
};
