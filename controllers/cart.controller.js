const Cart = require('../models/Cart.model');
const Product = require('../models/Product.model');
const { asyncHandler, AppError } = require('../middleware/error');

const COUPONS = {
  SAVE10: { discountType: 'percentage', discountValue: 10 },
  SAVE20: { discountType: 'percentage', discountValue: 20 },
  SAVE50: { discountType: 'percentage', discountValue: 50 },
  SAVE80: { discountType: 'percentage', discountValue: 80 },
  OFF50:  { discountType: 'fixed',      discountValue: 50  },
};

const getOrCreateCart = async (userId) => {
  let cart = await Cart.findOne({ user: userId });
  if (!cart) cart = await Cart.create({ user: userId, items: [] });
  return cart;
};

// GET /carts
const getCart = asyncHandler(async (req, res) => {
  const cart = await getOrCreateCart(req.user._id);
  res.status(200).json({ success: true, cart });
});

// POST /carts/items
const addItem = asyncHandler(async (req, res) => {
  const { productId, quantity = 1 } = req.body;
  if (!productId) throw new AppError('productId is required.', 400);

  const product = await Product.findById(productId);
  if (!product || !product.isActive) throw new AppError('Product not found or unavailable.', 404);

  const cart = await getOrCreateCart(req.user._id);

  const existingIndex = cart.items.findIndex((i) => i.product.toString() === productId);
  const qty = parseInt(quantity);

  if (existingIndex !== -1) {
    const newQty = cart.items[existingIndex].quantity + qty;
    if (newQty > product.stock + cart.items[existingIndex].quantity) {
      throw new AppError(`Only ${product.stock} units available.`, 400);
    }
    cart.items[existingIndex].quantity = newQty;
  } else {
    if (qty > product.stock) throw new AppError(`Only ${product.stock} units available.`, 400);
    cart.items.push({
      product: product._id,
      name: product.name,
      image: product.images[0].url,
      price: product.discountPrice > 0 ? product.discountPrice : product.price,
      quantity: qty,
    });
  }

  // Deduct stock immediately
  product.stock -= qty;
  await product.save();
  await cart.save();

  res.status(200).json({ success: true, cart });
});

// PATCH /carts/items
const updateItem = asyncHandler(async (req, res) => {
  const { productId, quantity } = req.body;
  if (!productId || quantity === undefined) throw new AppError('productId and quantity are required.', 400);

  const cart = await Cart.findOne({ user: req.user._id });
  if (!cart) throw new AppError('Cart not found.', 404);

  const itemIndex = cart.items.findIndex((i) => i.product.toString() === productId);
  if (itemIndex === -1) throw new AppError('Item not in cart.', 404);

  const product = await Product.findById(productId);
  if (!product) throw new AppError('Product not found.', 404);

  const oldQty = cart.items[itemIndex].quantity;
  const newQty = parseInt(quantity);
  const diff = newQty - oldQty;

  if (newQty <= 0) throw new AppError('Quantity must be at least 1.', 400);
  if (diff > 0 && product.stock < diff) throw new AppError(`Only ${product.stock} additional units available.`, 400);

  product.stock -= diff;
  await product.save();

  cart.items[itemIndex].quantity = newQty;
  await cart.save();

  res.status(200).json({ success: true, cart });
});

// DELETE /carts/items/:productId
const removeItem = asyncHandler(async (req, res) => {
  const cart = await Cart.findOne({ user: req.user._id });
  if (!cart) throw new AppError('Cart not found.', 404);

  const itemIndex = cart.items.findIndex((i) => i.product.toString() === req.params.productId);
  if (itemIndex === -1) throw new AppError('Item not in cart.', 404);

  const qty = cart.items[itemIndex].quantity;
  await Product.findByIdAndUpdate(req.params.productId, { $inc: { stock: qty } });

  cart.items.splice(itemIndex, 1);
  await cart.save();

  res.status(200).json({ success: true, cart });
});

// POST /carts/coupon
const applyCoupon = asyncHandler(async (req, res) => {
  const { code } = req.body;
  const coupon = COUPONS[code?.toUpperCase()];
  if (!coupon) throw new AppError('Invalid coupon code.', 400);

  const cart = await Cart.findOne({ user: req.user._id });
  if (!cart) throw new AppError('Cart not found.', 404);

  cart.coupon = { code: code.toUpperCase(), ...coupon };
  await cart.save();

  res.status(200).json({ success: true, cart });
});

// DELETE /carts/coupon
const removeCoupon = asyncHandler(async (req, res) => {
  const cart = await Cart.findOne({ user: req.user._id });
  if (!cart) throw new AppError('Cart not found.', 404);
  cart.coupon = {};
  await cart.save();
  res.status(200).json({ success: true, cart });
});

// DELETE /carts/clear
const clearCart = asyncHandler(async (req, res) => {
  const cart = await Cart.findOne({ user: req.user._id });
  if (!cart) throw new AppError('Cart not found.', 404);

  // Restore all stock
  for (const item of cart.items) {
    await Product.findByIdAndUpdate(item.product, { $inc: { stock: item.quantity } });
  }

  cart.items = [];
  cart.coupon = {};
  await cart.save();

  res.status(200).json({ success: true, message: 'Cart cleared.' });
});

module.exports = { getCart, addItem, updateItem, removeItem, applyCoupon, removeCoupon, clearCart };
