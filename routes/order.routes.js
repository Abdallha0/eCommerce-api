const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/auth');
const {
  createOrder, getMyOrders, getMyOrderById, cancelMyOrder,
  adminGetAllOrders, adminGetOrderById, adminUpdateOrderStatus,
  adminDashboard, adminGetAllCarts,
} = require('../controllers/order.controller');

// User routes
router.post('/', protect, createOrder);
router.get('/my', protect, getMyOrders);
router.get('/my/:id', protect, getMyOrderById);
router.patch('/my/:id/cancel', protect, cancelMyOrder);

// Admin routes
router.get('/admin/dashboard', protect, adminOnly, adminDashboard);
router.get('/admin/carts', protect, adminOnly, adminGetAllCarts);
router.get('/admin', protect, adminOnly, adminGetAllOrders);
router.get('/admin/:id', protect, adminOnly, adminGetOrderById);
router.patch('/admin/:id/status', protect, adminOnly, adminUpdateOrderStatus);

module.exports = router;
