const Wishlist = require('../models/Wishlist.model');
const Product = require('../models/Product.model');
const { asyncHandler, AppError } = require('../middleware/error');

const getOrCreateWishlist = async (userId) => {
  let wishlist = await Wishlist.findOne({ user: userId });
  if (!wishlist) wishlist = await Wishlist.create({ user: userId, products: [] });
  return wishlist;
};

// GET /wishlists/my
const getMyWishlist = asyncHandler(async (req, res) => {
  const wishlist = await getOrCreateWishlist(req.user._id);
  res.status(200).json({ success: true, wishlist });
});

// POST /wishlists/add/:productId
const addToWishlist = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.productId);
  if (!product) throw new AppError('Product not found.', 404);

  const wishlist = await getOrCreateWishlist(req.user._id);
  const alreadyIn = wishlist.products.some((p) => p._id?.toString() === req.params.productId || p.toString() === req.params.productId);
  if (alreadyIn) throw new AppError('Product already in wishlist.', 409);

  wishlist.products.push(req.params.productId);
  await wishlist.save();

  const updated = await Wishlist.findById(wishlist._id);
  res.status(200).json({ success: true, wishlist: updated });
});

// DELETE /wishlists/remove/:productId
const removeFromWishlist = asyncHandler(async (req, res) => {
  const wishlist = await Wishlist.findOne({ user: req.user._id });
  if (!wishlist) throw new AppError('Wishlist not found.', 404);

  wishlist.products = wishlist.products.filter((p) => {
    const id = p._id ? p._id.toString() : p.toString();
    return id !== req.params.productId;
  });
  await wishlist.save();

  const updated = await Wishlist.findById(wishlist._id);
  res.status(200).json({ success: true, wishlist: updated });
});

// DELETE /wishlists/clear
const clearWishlist = asyncHandler(async (req, res) => {
  const wishlist = await Wishlist.findOne({ user: req.user._id });
  if (!wishlist) throw new AppError('Wishlist not found.', 404);
  wishlist.products = [];
  await wishlist.save();
  res.status(200).json({ success: true, message: 'Wishlist cleared.' });
});

// GET /admin/wishlists
const adminGetAllWishlists = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const skip = (page - 1) * limit;

  const total = await Wishlist.countDocuments();
  const wishlists = await Wishlist.find().populate('user', 'username email').skip(skip).limit(limit);

  res.status(200).json({ success: true, total, page, pages: Math.ceil(total / limit), wishlists });
});

// GET /admin/wishlists/stats
const adminWishlistStats = asyncHandler(async (req, res) => {
  const stats = await Wishlist.aggregate([
    { $unwind: '$products' },
    { $group: { _id: '$products', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 10 },
    { $lookup: { from: 'products', localField: '_id', foreignField: '_id', as: 'product' } },
    { $unwind: '$product' },
    { $project: { _id: 0, product: { name: 1, _id: 1, images: { $slice: ['$product.images', 1] }, price: 1 }, count: 1 } },
  ]);
  res.status(200).json({ success: true, stats });
});

module.exports = { getMyWishlist, addToWishlist, removeFromWishlist, clearWishlist, adminGetAllWishlists, adminWishlistStats };
