const mongoose = require('mongoose');
const Order = require('../models/Order.model');
const Cart = require('../models/Cart.model');
const Product = require('../models/Product.model');
const User = require('../models/User.model');
const { asyncHandler, AppError } = require('../middleware/error');
const { sendEmail, orderConfirmationHtml, orderStatusHtml } = require('../utils/sendEmail');

const TAX_RATE = 0.14;
const FREE_SHIPPING_THRESHOLD = 1000;
const SHIPPING_FEE = 50;

// POST /orders
const createOrder = asyncHandler(async (req, res) => {
  const { shippingAddress, paymentMethod = 'cash', customerNote } = req.body;
  if (!shippingAddress) throw new AppError('Shipping address is required.', 400);

  const cart = await Cart.findOne({ user: req.user._id });
  if (!cart || cart.items.length === 0) throw new AppError('Cart is empty.', 400);

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Build order items and validate stock (stock already deducted when added to cart)
    const items = cart.items.map((item) => ({
      product: item.product,
      name: item.name,
      image: item.image,
      price: item.price,
      quantity: item.quantity,
    }));

    const subtotal = cart.subtotal;
    const discount = cart.discountAmount;
    const shippingFee = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;
    const tax = Math.round(subtotal * TAX_RATE * 100) / 100;
    const totalPrice = Math.max(0, subtotal + shippingFee + tax - discount);

    const [order] = await Order.create(
      [{ user: req.user._id, items, shippingAddress, paymentMethod, customerNote, subtotal, shippingFee, tax, discount, totalPrice }],
      { session }
    );

    // Clear cart
    cart.items = [];
    cart.coupon = {};
    await cart.save({ session });

    await session.commitTransaction();
    session.endSession();

    // Send confirmation email (non-blocking)
    sendEmail({ to: req.user.email, subject: 'Order Confirmed — SEF Store', html: orderConfirmationHtml(order, req.user) }).catch(console.error);

    res.status(201).json({ success: true, order });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
});

// GET /orders/my
const getMyOrders = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  const filter = { user: req.user._id };
  if (req.query.status) filter.status = req.query.status;

  const total = await Order.countDocuments(filter);
  const orders = await Order.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit);

  res.status(200).json({ success: true, total, page, pages: Math.ceil(total / limit), orders });
});

// GET /orders/my/:id
const getMyOrderById = asyncHandler(async (req, res) => {
  const order = await Order.findOne({ _id: req.params.id, user: req.user._id });
  if (!order) throw new AppError('Order not found.', 404);
  res.status(200).json({ success: true, order });
});

// PATCH /my/:id/cancel
const cancelMyOrder = asyncHandler(async (req, res) => {
  const order = await Order.findOne({ _id: req.params.id, user: req.user._id });
  if (!order) throw new AppError('Order not found.', 404);
  if (!['pending', 'confirmed'].includes(order.status)) {
    throw new AppError(`Cannot cancel an order with status "${order.status}".`, 400);
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    // Restore stock
    for (const item of order.items) {
      await Product.findByIdAndUpdate(item.product, { $inc: { stock: item.quantity } }, { session });
    }
    order.status = 'cancelled';
    order.cancelledAt = new Date();
    await order.save({ session });

    await session.commitTransaction();
    session.endSession();
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }

  res.status(200).json({ success: true, order });
});

// ─── Admin ───────────────────────────────────────────────────────────────────

// GET /admin  (all orders)
const adminGetAllOrders = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const skip = (page - 1) * limit;

  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.paymentStatus) filter.paymentStatus = req.query.paymentStatus;
  if (req.query.from || req.query.to) {
    filter.createdAt = {};
    if (req.query.from) filter.createdAt.$gte = new Date(req.query.from);
    if (req.query.to) filter.createdAt.$lte = new Date(req.query.to);
  }

  const sortMap = { newest: { createdAt: -1 }, oldest: { createdAt: 1 }, 'total-desc': { totalPrice: -1 } };
  const sort = sortMap[req.query.sort] || { createdAt: -1 };

  const total = await Order.countDocuments(filter);
  const orders = await Order.find(filter).populate('user', 'username email').sort(sort).skip(skip).limit(limit);

  res.status(200).json({ success: true, total, page, pages: Math.ceil(total / limit), orders });
});

// GET /admin/:id
const adminGetOrderById = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id).populate('user', 'username email phone');
  if (!order) throw new AppError('Order not found.', 404);
  res.status(200).json({ success: true, order });
});

// PATCH /admin/:id/status
const adminUpdateOrderStatus = asyncHandler(async (req, res) => {
  const { status, adminNote } = req.body;
  const validStatuses = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'returned'];
  if (!validStatuses.includes(status)) throw new AppError('Invalid status.', 400);

  const order = await Order.findById(req.params.id).populate('user', 'username email');
  if (!order) throw new AppError('Order not found.', 404);

  order.status = status;
  if (adminNote) order.adminNote = adminNote;
  if (status === 'delivered') order.deliveredAt = new Date();
  if (status === 'cancelled') order.cancelledAt = new Date();

  await order.save();

  sendEmail({ to: order.user.email, subject: `Order Update — SEF Store`, html: orderStatusHtml(order, order.user) }).catch(console.error);

  res.status(200).json({ success: true, order });
});

// GET /admin/dashboard
const adminDashboard = asyncHandler(async (req, res) => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

  const [
    revenueData,
    statusCounts,
    topProducts,
    dailyRevenue,
    recentOrders,
    customerCount,
    monthRevenue,
    lastMonthRevenue,
  ] = await Promise.all([
    // Total revenue
    Order.aggregate([
      { $match: { paymentStatus: 'paid' } },
      { $group: { _id: null, total: { $sum: '$totalPrice' } } },
    ]),
    // Orders by status
    Order.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    // Top 5 best-selling products
    Order.aggregate([
      { $match: { status: { $nin: ['cancelled', 'returned'] } } },
      { $unwind: '$items' },
      { $group: { _id: '$items.product', name: { $first: '$items.name' }, unitsSold: { $sum: '$items.quantity' }, revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } } } },
      { $sort: { unitsSold: -1 } },
      { $limit: 5 },
    ]),
    // Daily revenue — last 7 days
    Order.aggregate([
      { $match: { createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }, paymentStatus: 'paid' } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, revenue: { $sum: '$totalPrice' }, orders: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    // Recent 5 orders
    Order.find().sort({ createdAt: -1 }).limit(5).populate('user', 'username email'),
    // Customer count
    User.countDocuments({ role: 'customer' }),
    // This month revenue
    Order.aggregate([
      { $match: { createdAt: { $gte: startOfMonth }, paymentStatus: 'paid' } },
      { $group: { _id: null, total: { $sum: '$totalPrice' } } },
    ]),
    // Last month revenue
    Order.aggregate([
      { $match: { createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth }, paymentStatus: 'paid' } },
      { $group: { _id: null, total: { $sum: '$totalPrice' } } },
    ]),
  ]);

  const thisMonthRev = monthRevenue[0]?.total || 0;
  const lastMonthRev = lastMonthRevenue[0]?.total || 0;
  const monthGrowth = lastMonthRev === 0 ? 100 : Math.round(((thisMonthRev - lastMonthRev) / lastMonthRev) * 100);

  const statusMap = {};
  statusCounts.forEach(({ _id, count }) => { statusMap[_id] = count; });

  res.status(200).json({
    success: true,
    data: {
      revenue: { total: revenueData[0]?.total || 0, thisMonth: thisMonthRev, lastMonth: lastMonthRev, monthGrowth },
      orders: statusMap,
      topProducts,
      dailyRevenue,
      recentOrders,
      customerCount,
    },
  });
});

// GET /admin/carts
const adminGetAllCarts = asyncHandler(async (req, res) => {
  const carts = await Cart.find().populate('user', 'username email').populate('items.product', 'name price');
  res.status(200).json({ success: true, count: carts.length, carts });
});

module.exports = { createOrder, getMyOrders, getMyOrderById, cancelMyOrder, adminGetAllOrders, adminGetOrderById, adminUpdateOrderStatus, adminDashboard, adminGetAllCarts };
